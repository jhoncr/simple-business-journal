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
  return components.map((c) => {
    if (c.id === id) {
      return updater(c);
    }
    if (c.children) {
      return { ...c, children: updateComponentDeep(c.children, id, updater) };
    }
    return c;
  });
};

export const deleteComponentDeep = (
  components: SlabComponent[],
  id: string,
): SlabComponent[] => {
  return components
    .filter((c) => c.id !== id)
    .map((c) => {
      if (c.children) {
        return { ...c, children: deleteComponentDeep(c.children, id) };
      }
      return c;
    });
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
