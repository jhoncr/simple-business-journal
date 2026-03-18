'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useToolbar } from '@/app/(auth)/nav_tool_handler';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { SlabComponent, AssemblyTemplate, Cutout, Expression } from "@backend/common/schemas/studio";
import { evaluateExpression } from '../../lib/evaluator';
import { Slab3D } from './Slab3D';
import { Box, Layers, Settings, Save, Download, Plus, Trash2, CheckCircle2, Copy } from 'lucide-react';
import { functions, app } from '../../lib/auth_handler';
import { httpsCallable } from 'firebase/functions';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useSearchParams } from 'next/navigation';
import { fetchEntry } from '../../lib/db_handler';

const findComponentDeep = (components: SlabComponent[], id: string): SlabComponent | null => {
  for (const c of components) {
    if (c.id === id) return c;
    if (c.children) {
      const found = findComponentDeep(c.children, id);
      if (found) return found;
    }
  }
  return null;
};

const updateComponentDeep = (components: SlabComponent[], id: string, updater: (c: SlabComponent) => SlabComponent): SlabComponent[] => {
  return components.map(c => {
    if (c.id === id) {
      return updater(c);
    }
    if (c.children) {
      return { ...c, children: updateComponentDeep(c.children, id, updater) };
    }
    return c;
  });
};

const deleteComponentDeep = (components: SlabComponent[], id: string): SlabComponent[] => {
  return components.filter(c => c.id !== id).map(c => {
    if (c.children) {
      return { ...c, children: deleteComponentDeep(c.children, id) };
    }
    return c;
  });
};

export const StoneForgeEditor = () => {
  const searchParams = useSearchParams();
  const journalId = searchParams.get('jid');
  const entryId = searchParams.get('eid');
  const [isLoading, setIsLoading] = useState(!!entryId);

  const [template, setTemplate] = useState<AssemblyTemplate>({
    id: 'temp_1',
    name: 'Untitled Assembly',
    variables: [],
    components: [
      {
        id: 'slab_1',
        type: 'slab',
        name: 'Main Counter',
        length: 228.0,
        depth: 60.0,
        thickness: 2.0,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        cutouts: [
          { id: 'cut_1', shape: 'rectangular', width: 40.0, depth: 30.0, centerX: 49.0, centerY: 30.0 }
        ],
        children: []
      }
    ]
  });

  const [selectedComponentId, setSelectedComponentId] = useState<string | null>('slab_1');
  const [selectedEdge, setSelectedEdge] = useState<{ slabId: string, edge: 'front' | 'back' | 'left' | 'right' } | null>(null);
  const [activeLeftTab, setActiveLeftTab] = useState<'assembly' | 'variables'>('assembly');

  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { setToolBar } = useToolbar();

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    async function loadTemplate() {
      if (journalId && entryId) {
        try {
          const entry = await fetchEntry(journalId, 'template', entryId);
          if (entry && entry.details) {
            // Document ID from Firestore is entryId
            // The template.id in state should be the Firestore doc ID
            setTemplate({
              ...(entry.details as any),
              id: entryId, // Force the doc ID to be the template ID
            });
            setSelectedComponentId(null);
          }
        } catch (error) {
          console.error('Error fetching template:', error);
          showToast('Failed to load existing template.');
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }
    loadTemplate();
  }, [journalId, entryId]);

  const handleSaveTemplate = async () => {
    if (!journalId) {
      showToast('Cannot save: No journal ID provided in URL');
      return;
    }
    setIsSaving(true);
    try {
      const auth = getAuth(app);
      if (!auth.currentUser) {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
      
      if (auth.currentUser) {
        const addLogFunction = httpsCallable(functions, 'addLogFn');
        
        // If template.id is 'temp_1' or similar initial placeholder, it's a NEW template
        // Otherwise, it's an existing one. 
        // Note: New templates from 'duplicateEntry' will have a real Firestore ID.
        const isNew = template.id === 'temp_1';

        if (isNew) {
          // It's a new template, create a new document
          const payload = {
            journalId: journalId,
            entryType: 'template',
            name: template.name,
            details: template,
          };
          const response = await addLogFunction(payload);
          const newTemplateId = (response.data as any).id;
          
          // Update local state with the new ID
          setTemplate(prev => ({ ...prev, id: newTemplateId }));
          
          showToast('Template saved successfully!');
        } else {
          // It's an existing template, update it
          const payload = {
            journalId: journalId,
            entryType: 'template',
            entryId: template.id,
            name: template.name,
            details: template,
          };
          await addLogFunction(payload);
          showToast('Template updated successfully!');
        }
      }
    } catch (error) {
      console.error('Error saving template:', error);
      showToast('Failed to save template. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateTemplate = async () => {
    if (!journalId || template.id === 'temp_1') {
      showToast('Cannot duplicate: Save the template first or provide a journal ID');
      return;
    }

    setIsSaving(true);
    try {
      const duplicateFn = httpsCallable(functions, 'duplicateEntry');
      const response = await duplicateFn({
        journalId: journalId,
        entryId: template.id,
        entryType: 'template'
      });

      const newId = (response.data as any).id;
      if (newId) {
        showToast('Template duplicated! Reloading with new design...');
        // Redirect to the new template
        window.location.href = `/journal/entry?jid=${journalId}&eid=${newId}&jtype=template`;
      }
    } catch (error) {
      console.error('Error duplicating template:', error);
      showToast('Failed to duplicate template.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedComponent = selectedComponentId ? findComponentDeep(template.components, selectedComponentId) : null;

  const handleSelectComponent = (id: string) => {
    setSelectedComponentId(id);
    setSelectedEdge(null);
  };

  const handleSelectEdge = (id: string, edge: 'front' | 'back' | 'left' | 'right') => {
    setSelectedEdge({ slabId: id, edge });
    setSelectedComponentId(null);
  };

  const variablesMap = useMemo(() => {
    const map: Record<string, number> = {};
    template.variables.forEach(v => {
      if (v.label) {
        map[v.label] = v.default;
      }
    });
    return map;
  }, [template.variables]);

  const handleAddComponent = () => {
    const newId = `slab_${Date.now()}`;
    
    // Find the largest Z coordinate in the existing design
    let maxZ = 0;
    const findMaxZ = (comps: SlabComponent[], currentZ: number) => {
      comps.forEach(c => {
        const z = currentZ + evaluateExpression(c.position[2], variablesMap);
        if (z > maxZ) maxZ = z;
        if (c.children) findMaxZ(c.children, z);
      });
    };
    findMaxZ(template.components, 0);
    
    // Place the new component 4 units away from the front-most edge
    // Since depth goes into -Z, placing it at maxZ + 60 + 4 ensures its back edge is at maxZ + 4
    const newZ = maxZ === 0 && template.components.length === 0 ? 0 : maxZ + 64;

    setTemplate(prev => ({
      ...prev,
      components: [
        ...prev.components,
        {
          id: newId,
          type: 'slab',
          name: `New Slab ${prev.components.length + 1}`,
          length: 100.0,
          depth: 60.0,
          thickness: 2.0,
          position: [0, 0, newZ],
          rotation: [0, 0, 0],
          cutouts: [],
          children: []
        }
      ]
    }));
    setSelectedComponentId(newId);
    setSelectedEdge(null);
  };

  const handleRemoveComponent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplate(prev => ({
      ...prev,
      components: deleteComponentDeep(prev.components, id)
    }));
    if (selectedComponentId === id) setSelectedComponentId(null);
    if (selectedEdge?.slabId === id) setSelectedEdge(null);
  };

  const handleAddEdgeComponent = (type: 'splash' | 'waterfall' | 'drop' | 'raised' | 'custom') => {
    if (!selectedEdge) return;
    const { slabId, edge } = selectedEdge;
    const parent = findComponentDeep(template.components, slabId);
    if (!parent) return;

    const newId = `comp_${Date.now()}`;
    let newComp: SlabComponent = {
      id: newId,
      type: 'slab',
      name: 'New Component',
      length: 100,
      depth: 60,
      thickness: 2,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      cutouts: [],
      children: []
    };

    const T = parent.thickness;
    const L = parent.length;
    const D = parent.depth;

    const subExpr = (e1: Expression, e2: Expression): Expression => {
      if (typeof e1 === 'number' && typeof e2 === 'number') return e1 - e2;
      return `(${e1}) - (${e2})`;
    };

    let addToRoot = false;

    if (type === 'splash') {
      newComp.name = `${edge} Splash`;
      newComp.thickness = 10;
      if (edge === 'front' || edge === 'back') {
        newComp.length = L;
        newComp.depth = 2;
        newComp.position = [0, T, edge === 'front' ? 0 : subExpr(2, D)];
      } else {
        newComp.length = 2;
        newComp.depth = D;
        newComp.position = [edge === 'left' ? 0 : subExpr(L, 2), T, 0];
      }
    } else if (type === 'waterfall') {
      newComp.name = `${edge} Waterfall`;
      newComp.thickness = 90;
      if (edge === 'front' || edge === 'back') {
        newComp.length = L;
        newComp.depth = 2;
        newComp.position = [0, -90, edge === 'front' ? 0 : subExpr(2, D)];
      } else {
        newComp.length = 2;
        newComp.depth = D;
        newComp.position = [edge === 'left' ? 0 : subExpr(L, 2), -90, 0];
      }
    } else if (type === 'drop') {
      newComp.name = `${edge} Drop Edge`;
      newComp.thickness = 2;
      if (edge === 'front' || edge === 'back') {
        newComp.length = L;
        newComp.depth = 4;
        newComp.position = [0, -2, edge === 'front' ? 0 : subExpr(4, D)];
      } else {
        newComp.length = 4;
        newComp.depth = D;
        newComp.position = [edge === 'left' ? 0 : subExpr(L, 4), -2, 0];
      }
    } else if (type === 'raised') {
      newComp.name = `${edge} Raised Edge`;
      newComp.thickness = 2;
      if (edge === 'front' || edge === 'back') {
        newComp.length = L;
        newComp.depth = 4;
        newComp.position = [0, T, edge === 'front' ? 0 : subExpr(4, D)];
      } else {
        newComp.length = 4;
        newComp.depth = D;
        newComp.position = [edge === 'left' ? 0 : subExpr(L, 4), T, 0];
      }
    } else if (type === 'custom') {
      addToRoot = true;
      newComp.name = `${edge} Custom`;
      newComp.thickness = T;
      
      const localOffset = new THREE.Vector3();
      const evalL = evaluateExpression(L, variablesMap);
      const evalD = evaluateExpression(D, variablesMap);
      
      if (edge === 'front') {
        newComp.length = L;
        newComp.depth = 60;
        localOffset.set(0, 0, 60);
      } else if (edge === 'back') {
        newComp.length = L;
        newComp.depth = 60;
        localOffset.set(0, 0, -evalD);
      } else if (edge === 'left') {
        newComp.length = 60;
        newComp.depth = D;
        localOffset.set(-60, 0, 0);
      } else if (edge === 'right') {
        newComp.length = 60;
        newComp.depth = D;
        localOffset.set(evalL, 0, 0);
      }

      const getComponentWorldTransform = (comps: SlabComponent[], targetId: string, parentObj = new THREE.Object3D()): { pos: THREE.Vector3, rot: THREE.Euler } | null => {
        for (const c of comps) {
          const childObj = new THREE.Object3D();
          childObj.position.set(
            evaluateExpression(c.position[0], variablesMap),
            evaluateExpression(c.position[1], variablesMap),
            evaluateExpression(c.position[2], variablesMap)
          );
          childObj.rotation.set(
            c.rotation ? evaluateExpression(c.rotation[0], variablesMap) : 0,
            c.rotation ? evaluateExpression(c.rotation[1], variablesMap) : 0,
            c.rotation ? evaluateExpression(c.rotation[2], variablesMap) : 0
          );
          parentObj.add(childObj);
          parentObj.updateMatrixWorld(true);
          
          if (c.id === targetId) {
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            childObj.getWorldPosition(worldPos);
            childObj.getWorldQuaternion(worldQuat);
            const worldRot = new THREE.Euler().setFromQuaternion(worldQuat);
            parentObj.remove(childObj);
            return { pos: worldPos, rot: worldRot };
          }
          
          if (c.children) {
            const res = getComponentWorldTransform(c.children, targetId, childObj);
            if (res) {
              parentObj.remove(childObj);
              return res;
            }
          }
          parentObj.remove(childObj);
        }
        return null;
      };

      const worldTransform = getComponentWorldTransform(template.components, slabId);
      if (worldTransform) {
        localOffset.applyEuler(worldTransform.rot);
        const newWorldPos = worldTransform.pos.add(localOffset);
        
        const round = (n: number) => Math.round(n * 100) / 100;
        
        newComp.position = [round(newWorldPos.x), round(newWorldPos.y), round(newWorldPos.z)];
        newComp.rotation = [round(worldTransform.rot.x), round(worldTransform.rot.y), round(worldTransform.rot.z)];
      }
    }

    setTemplate(prev => {
      if (addToRoot) {
        return {
          ...prev,
          components: [...prev.components, newComp]
        };
      } else {
        return {
          ...prev,
          components: updateComponentDeep(prev.components, slabId, (c) => ({
            ...c,
            children: [...(c.children || []), newComp]
          }))
        };
      }
    });
    setSelectedComponentId(newId);
    setSelectedEdge(null);
  };

  const handleAddVariable = () => {
    const newId = `var_${Date.now()}`;
    setTemplate(prev => ({
      ...prev,
      variables: [
        ...prev.variables,
        { id: newId, label: 'new_var', default: 0 }
      ]
    }));
  };

  const handleUpdateVariable = (id: string, field: 'label' | 'default', value: any) => {
    setTemplate(prev => ({
      ...prev,
      variables: prev.variables.map(v => v.id === id ? { ...v, [field]: value } : v)
    }));
  };

  const handleRemoveVariable = (id: string) => {
    setTemplate(prev => ({
      ...prev,
      variables: prev.variables.filter(v => v.id !== id)
    }));
  };

  const handleAddCutout = (slabId: string) => {
    setTemplate(prev => ({
      ...prev,
      components: updateComponentDeep(prev.components, slabId, (c) => ({
        ...c,
        cutouts: [
          ...c.cutouts,
          { 
            id: `cut_${Date.now()}`, 
            shape: 'rectangular', 
            width: 40, 
            depth: 30, 
            centerX: evaluateExpression(c.length, variablesMap) / 2, 
            centerY: evaluateExpression(c.depth, variablesMap) / 2 
          }
        ]
      }))
    }));
  };

  const handleUpdateCutout = (slabId: string, cutoutId: string, field: keyof Cutout, value: any) => {
    setTemplate(prev => ({
      ...prev,
      components: updateComponentDeep(prev.components, slabId, (c) => ({
        ...c,
        cutouts: c.cutouts.map(cut => cut.id === cutoutId ? { ...cut, [field]: value } : cut)
      }))
    }));
  };

  const handleRemoveCutout = (slabId: string, cutoutId: string) => {
    setTemplate(prev => ({
      ...prev,
      components: updateComponentDeep(prev.components, slabId, (c) => ({
        ...c,
        cutouts: c.cutouts.filter(cut => cut.id !== cutoutId)
      }))
    }));
  };

  const handleExport = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      try {
        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'stoneforge-design.png';
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('Error exporting image:', error);
      }
    }
  };

  const handleComponentChange = (id: string, field: keyof SlabComponent, value: any) => {
    setTemplate(prev => ({
      ...prev,
      components: updateComponentDeep(prev.components, id, (c) => ({
        ...c,
        [field]: value
      }))
    }));
  };

  const renderComponentTree = (components: SlabComponent[], depth = 0) => {
    return components.map(comp => (
      <React.Fragment key={comp.id}>
        <div 
          onClick={() => handleSelectComponent(comp.id)}
          className={`px-3 py-2 rounded-md text-sm cursor-pointer flex justify-between items-center ${selectedComponentId === comp.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
          style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
        >
          <span className="truncate pr-2">{comp.name}</span>
          <button onClick={(e) => handleRemoveComponent(comp.id, e)}>
            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500 flex-shrink-0" />
          </button>
        </div>
        {comp.children && renderComponentTree(comp.children, depth + 1)}
      </React.Fragment>
    ));
  };

  // Set toolbar content in the auth layout header
  useEffect(() => {
    if (isLoading) return;
    setToolBar(
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Box className="w-5 h-5 text-indigo-600" />
          <h1 className="font-semibold text-gray-900">StoneForge 3D</h1>
          <span className="text-gray-400 mx-2">|</span>
          <input 
            type="text" 
            value={template.name}
            onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
            className="text-sm font-medium text-gray-700 bg-transparent border-none focus:ring-0 p-0 w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="bg-white border border-gray-300 text-gray-700 py-1.5 px-3 rounded-md text-xs font-medium hover:bg-gray-50 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export Image
          </button>
          {template.id !== 'temp_1' && (
            <button 
              onClick={handleDuplicateTemplate}
              disabled={isSaving}
              className="bg-white border border-indigo-200 text-indigo-700 py-1.5 px-3 rounded-md text-xs font-medium hover:bg-indigo-50 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" /> Duplicate Design
            </button>
          )}
          <button 
            onClick={handleSaveTemplate}
            disabled={isSaving}
            className="bg-indigo-600 text-white py-1.5 px-3 rounded-md text-xs font-medium hover:bg-indigo-700 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {isSaving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    );
    return () => setToolBar(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, template, isSaving, setToolBar]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="text-sm font-medium text-gray-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-gray-100 overflow-hidden font-sans">

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar (Library & Variables) */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
          <div className="p-3 border-b border-gray-100 bg-gray-50 flex gap-2">
            <button 
              onClick={() => setActiveLeftTab('assembly')}
              className={`flex-1 text-xs font-medium py-1.5 rounded ${activeLeftTab === 'assembly' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Assembly
            </button>
            <button 
              onClick={() => setActiveLeftTab('variables')}
              className={`flex-1 text-xs font-medium py-1.5 rounded ${activeLeftTab === 'variables' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Variables
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {activeLeftTab === 'assembly' ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Components
                  </h3>
                  <button onClick={handleAddComponent} className="text-gray-400 hover:text-indigo-600">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {renderComponentTree(template.components)}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    Variables
                  </h3>
                  <button onClick={handleAddVariable} className="text-gray-400 hover:text-indigo-600">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {template.variables.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-4">No variables defined yet.</p>
                  )}
                  {template.variables.map(v => (
                    <div key={v.id} className="p-2 bg-gray-50 rounded-md border border-gray-200">
                      <input 
                        type="text"
                        value={v.label} 
                        onChange={(e) => {
                          // Only allow alphanumeric and underscores
                          const safeLabel = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                          handleUpdateVariable(v.id, 'label', safeLabel);
                        }} 
                        className="text-xs font-medium text-gray-700 w-full mb-2 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500" 
                        placeholder="Variable Name (e.g. length_a)"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">Default:</span>
                        <input 
                          type="number" 
                          value={v.default} 
                          onChange={(e) => handleUpdateVariable(v.id, 'default', parseFloat(e.target.value) || 0)} 
                          className="text-xs flex-1 p-1 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500" 
                        />
                        <button onClick={() => handleRemoveVariable(v.id)} className="p-1 hover:bg-gray-200 rounded">
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center Workspace (3D Canvas) */}
        <div className="flex-1 relative bg-gray-50">
          <Canvas camera={{ position: [150, 150, 200], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
            <color attach="background" args={['#f9fafb']} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[100, 200, 100]} intensity={1} castShadow />
            
            <React.Suspense fallback={null}>
              <Environment preset="city" />
              
              {/* Center the assembly */}
              <group position={[-100, 0, 50]}>
                {template.components.map(comp => (
                  <Slab3D 
                    key={comp.id} 
                    slab={comp} 
                    isSelected={selectedComponentId === comp.id}
                    onSelect={handleSelectComponent}
                    selectedComponentId={selectedComponentId}
                    onEdgeSelect={handleSelectEdge}
                    selectedEdge={selectedEdge}
                    variables={variablesMap}
                  />
                ))}
                
                <Grid 
                  position={[100, -0.1, -50]} 
                  args={[500, 500]} 
                  cellSize={10} 
                  cellThickness={1} 
                  cellColor="#e5e7eb" 
                  sectionSize={50} 
                  sectionThickness={1.5} 
                  sectionColor="#d1d5db" 
                  fadeDistance={400} 
                  fadeStrength={1} 
                />
              </group>
            </React.Suspense>
            
              <OrbitControls makeDefault minDistance={50} maxDistance={500} />
          </Canvas>
        </div>

        {/* Right Sidebar (Properties Inspector) */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full shadow-sm z-10">
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" /> Properties
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {selectedEdge ? (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 capitalize mb-1">{selectedEdge.edge} Edge Selected</h4>
                  <p className="text-xs text-gray-500 mb-4">Add an attached component to this edge.</p>
                  <div className="grid grid-cols-1 gap-2">
                    <button onClick={() => handleAddEdgeComponent('splash')} className="text-xs bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-300 text-left flex items-center justify-between">
                      <span>Add Splash</span>
                      <Plus className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => handleAddEdgeComponent('waterfall')} className="text-xs bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-300 text-left flex items-center justify-between">
                      <span>Add Waterfall</span>
                      <Plus className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => handleAddEdgeComponent('drop')} className="text-xs bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-300 text-left flex items-center justify-between">
                      <span>Add Drop Edge</span>
                      <Plus className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => handleAddEdgeComponent('raised')} className="text-xs bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded border border-gray-300 text-left flex items-center justify-between">
                      <span>Add Raised Edge</span>
                      <Plus className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => handleAddEdgeComponent('custom')} className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 px-3 rounded border border-indigo-200 text-left flex items-center justify-between mt-2">
                      <span>Add Custom Component</span>
                      <Plus className="w-3.5 h-3.5 text-indigo-500" />
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedComponent ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                  <input 
                    type="text" 
                    value={selectedComponent.name}
                    onChange={(e) => handleComponentChange(selectedComponent.id, 'name', e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Length (X)</label>
                    <input 
                      type="text" 
                      value={selectedComponent.length}
                      onChange={(e) => handleComponentChange(selectedComponent.id, 'length', e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Thickness (Y)</label>
                    <input 
                      type="text" 
                      value={selectedComponent.thickness}
                      onChange={(e) => handleComponentChange(selectedComponent.id, 'thickness', e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Depth (Z)</label>
                    <input 
                      type="text" 
                      value={selectedComponent.depth}
                      onChange={(e) => handleComponentChange(selectedComponent.id, 'depth', e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-900 mb-3">Position</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {['X', 'Y', 'Z'].map((axis, i) => (
                      <div key={axis}>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1">{axis}</label>
                        <input 
                          type="text" 
                          value={selectedComponent.position[i as 0 | 1 | 2]}
                          onChange={(e) => {
                            const newPos = [...selectedComponent.position] as [Expression, Expression, Expression];
                            newPos[i] = e.target.value;
                            handleComponentChange(selectedComponent.id, 'position', newPos);
                          }}
                          className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-900 mb-3">Rotation (Radians)</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {['X', 'Y', 'Z'].map((axis, i) => (
                      <div key={axis}>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1">{axis}</label>
                        <input 
                          type="text" 
                          value={selectedComponent.rotation?.[i as 0 | 1 | 2] || 0}
                          onChange={(e) => {
                            const newRot = [...(selectedComponent.rotation || [0,0,0])] as [Expression, Expression, Expression];
                            newRot[i] = e.target.value;
                            handleComponentChange(selectedComponent.id, 'rotation', newRot);
                          }}
                          className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-gray-900">Sinks / Cutouts</h4>
                    <button onClick={() => handleAddCutout(selectedComponent.id)} className="text-indigo-600 hover:text-indigo-800">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {selectedComponent.cutouts.length === 0 && (
                    <p className="text-[10px] text-gray-500 mb-4">No sinks added.</p>
                  )}
                  {selectedComponent.cutouts.map((cutout, idx) => (
                    <div key={cutout.id} className="mb-3 bg-gray-50 p-2 rounded-md border border-gray-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-gray-700">Sink {idx + 1}</span>
                        <button onClick={() => handleRemoveCutout(selectedComponent.id, cutout.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Shape</label>
                          <select 
                            value={cutout.shape}
                            onChange={(e) => handleUpdateCutout(selectedComponent.id, cutout.id, 'shape', e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="rectangular">Rectangular</option>
                            <option value="circular">Circular</option>
                            <option value="oval">Oval</option>
                          </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Center X (from Left)</label>
                            <input 
                              type="text" 
                              value={cutout.centerX}
                              onChange={(e) => handleUpdateCutout(selectedComponent.id, cutout.id, 'centerX', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Center Y (from Front)</label>
                            <input 
                              type="text" 
                              value={cutout.centerY}
                              onChange={(e) => handleUpdateCutout(selectedComponent.id, cutout.id, 'centerY', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">
                              {cutout.shape === 'circular' ? 'Diameter' : 'Width'}
                            </label>
                            <input 
                              type="text" 
                              value={cutout.width}
                              onChange={(e) => handleUpdateCutout(selectedComponent.id, cutout.id, 'width', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                            />
                          </div>
                          {cutout.shape !== 'circular' && (
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-1">Depth</label>
                              <input 
                                type="text" 
                                value={cutout.depth}
                                onChange={(e) => handleUpdateCutout(selectedComponent.id, cutout.id, 'depth', e.target.value)}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 text-center mt-10">
                Select a component to edit its properties.
              </div>
            )}
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-md shadow-lg text-sm z-50 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          {toastMessage}
        </div>
      )}
    </div>
  );
};
