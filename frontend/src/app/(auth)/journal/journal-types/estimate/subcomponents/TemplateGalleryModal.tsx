import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Box, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { AssemblyTemplate } from "@backend/common/schemas/studio";
import { DBentry } from "@/lib/custom_types";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { app } from "@/lib/auth_handler";
import { getFirestore, doc, getDoc } from "firebase/firestore";

interface TemplateGalleryModalProps {
  journalId: string;
  onSelectTemplate: (templateEntry: DBentry) => void;
  disabled?: boolean;
}

interface CacheEntry {
  n: string; // name
  d?: string; // description
  t?: string; // thumbnailUrl
}

export function TemplateGalleryModal({ journalId, onSelectTemplate, disabled }: TemplateGalleryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheMap, setCacheMap] = useState<Record<string, CacheEntry>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;

    const fetchCache = async () => {
      setLoading(true);
      setError(null);
      try {
        const db = getFirestore(app);
        const cacheDocRef = doc(db, `journals/${journalId}/fast-cache/templates`);
        const snapshot = await getDoc(cacheDocRef);
        if (snapshot.exists()) {
          setCacheMap(snapshot.data() as Record<string, CacheEntry>);
        } else {
          setCacheMap({});
        }
      } catch (err: any) {
        console.error("Failed to fetch templates cache:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCache();
  }, [isOpen, journalId]);

  useEffect(() => {
    let isMounted = true;
    const fetchUrls = async () => {
      const storage = getStorage(app);
      const newUrls: Record<string, string> = {};
      for (const [id, entry] of Object.entries(cacheMap)) {
        if (entry.t) {
          if (entry.t.startsWith("http") || entry.t.startsWith("data:")) {
            newUrls[id] = entry.t;
          } else {
            try {
              const url = await getDownloadURL(ref(storage, entry.t));
              newUrls[id] = url;
            } catch (e) {
              console.error("Failed to fetch image url for", id, e);
            }
          }
        }
      }
      if (isMounted) {
        setImageUrls(newUrls);
      }
    };
    if (Object.keys(cacheMap).length > 0) {
      fetchUrls();
    }
    return () => { isMounted = false; };
  }, [cacheMap]);

  const handleSelect = async (templateId: string) => {
    setLoading(true);
    try {
      const db = getFirestore(app);
      const templateDocRef = doc(db, `journals/${journalId}/templates`, templateId);
      const snapshot = await getDoc(templateDocRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        const templateEntry: DBentry = {
          id: snapshot.id,
          name: data.name,
          details: data.details,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          createdBy: data.createdBy,
          isActive: data.isActive,
        };
        onSelectTemplate(templateEntry);
        setIsOpen(false);
      } else {
        setError("Template no longer exists.");
      }
    } catch (err: any) {
      console.error("Failed to fetch full template:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = Object.entries(cacheMap).filter(([_, entry]) => {
    const term = searchTerm.toLowerCase();
    const matchesName = entry.n?.toLowerCase().includes(term);
    const matchesDesc = entry.d?.toLowerCase().includes(term);
    return matchesName || matchesDesc;
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          className="w-full gap-2"
        >
          <Box size={16} /> Add from Gallery
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Template Gallery</DialogTitle>
        </DialogHeader>

        <div className="px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">
              Failed to load templates: {error}
            </div>
          ) : Object.keys(cacheMap).length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Box className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No templates found in this journal.</p>
              <p className="text-sm mt-2">Go to the Journal to create your first template.</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <p>No templates match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredTemplates.map(([id, entry]) => (
                <div
                  key={id}
                  className="border rounded-lg p-4 cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors flex flex-col group"
                  onClick={() => handleSelect(id)}
                >
                  <div className="bg-secondary/30 rounded-md h-32 w-full mb-3 flex items-center justify-center relative overflow-hidden">
                    {entry.t ? (
                      imageUrls[id] ? (
                        <Image
                          src={imageUrls[id]}
                          alt={entry.n || "Template thumbnail"}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground z-10" />
                      )
                    ) : (
                      <Box className="h-10 w-10 text-muted-foreground/40 group-hover:text-primary/40 transition-colors z-10" />
                    )}
                  </div>
                  <h3 className="font-semibold text-sm truncate" title={entry.n}>
                    {entry.n || "Untitled Template"}
                  </h3>
                  {entry.d && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {entry.d}
                    </p>
                  )}
                  <div className="flex justify-end items-center mt-auto pt-2">
                    <Button size="sm" variant="secondary" className="h-7 text-xs">
                      Select
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
