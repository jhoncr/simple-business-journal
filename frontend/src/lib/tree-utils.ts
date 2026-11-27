import { SlabComponent, DimensionLabel } from "@backend/common/schemas/studio";

export const findComponentDeep = (
  components: SlabComponent[],
  id: string,
): SlabComponent | null => {
  for (const c of components) {
    if (c.id === id) return c;
    if (c.children) {
      const found = findComponentDeep(c.children, id);
      if (found) return found;
    }
  }
  return null;
};

export const updateComponentDeep = (
  components: SlabComponent[],
  id: string,
  updater: (c: SlabComponent) => SlabComponent,
): SlabComponent[] => {
  let changed = false;
  const next = components.map((c) => {
    if (c.id === id) {
      const updated = updater(c);
      if (updated !== c) changed = true;
      return updated;
    }
    if (c.children && c.children.length > 0) {
      const nextChildren = updateComponentDeep(c.children, id, updater);
      if (nextChildren !== c.children) {
        changed = true;
        return { ...c, children: nextChildren };
      }
    }
    return c;
  });
  return changed ? next : components;
};

export const deleteComponentDeep = (
  components: SlabComponent[],
  id: string,
): SlabComponent[] => {
  let changed = false;
  const next: SlabComponent[] = [];
  for (const c of components) {
    if (c.id === id) {
      changed = true;
      continue;
    }
    if (c.children && c.children.length > 0) {
      const nextChildren = deleteComponentDeep(c.children, id);
      if (nextChildren !== c.children) {
        changed = true;
        next.push({ ...c, children: nextChildren });
        continue;
      }
    }
    next.push(c);
  }
  return changed ? next : components;
};

export const collectSubtreeIds = (
  components: SlabComponent[],
  targetId: string,
): { componentIds: Set<string>; labelIds: Set<string> } => {
  const componentIds = new Set<string>();
  const labelIds = new Set<string>();

  const collectAll = (comp: SlabComponent) => {
    componentIds.add(comp.id);
    comp.dimensionLabels?.forEach((lbl) => labelIds.add(lbl.id));
    comp.children?.forEach(collectAll);
  };

  const target = findComponentDeep(components, targetId);
  if (target) {
    collectAll(target);
  }

  return { componentIds, labelIds };
};

export const findDimensionLabelDeep = (
  components: SlabComponent[],
  labelId: string,
): { slabId: string; label: DimensionLabel } | null => {
  for (const c of components) {
    const found = c.dimensionLabels?.find((l) => l.id === labelId);
    if (found) return { slabId: c.id, label: found };
    if (c.children) {
      const res = findDimensionLabelDeep(c.children, labelId);
      if (res) return res;
    }
  }
  return null;
};
