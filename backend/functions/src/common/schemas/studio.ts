import { z } from 'zod';

export const CutoutShapeSchema = z.enum(['rectangular', 'circular', 'oval']);
export type CutoutShape = z.infer<typeof CutoutShapeSchema>;

export const ExpressionSchema = z.union([z.string(), z.number()]);
export type Expression = z.infer<typeof ExpressionSchema>;

export const CutoutSchema = z.object({
  id: z.string(),
  shape: CutoutShapeSchema,
  width: ExpressionSchema,
  depth: ExpressionSchema,
  centerX: ExpressionSchema, // Offset from left edge
  centerY: ExpressionSchema, // Offset from front edge
});
export type Cutout = z.infer<typeof CutoutSchema>;

export const DimensionLabelSchema = z.object({
  id: z.string(),
  type: z.literal('dimension_label'),
  name: z.string(),
  edge: z.string(),
  text: ExpressionSchema,
  offset: z.number().default(15),
  startPos: z.tuple([ExpressionSchema, ExpressionSchema, ExpressionSchema]).optional(),
  endPos: z.tuple([ExpressionSchema, ExpressionSchema, ExpressionSchema]).optional(),
  offsetDirection: z.tuple([ExpressionSchema, ExpressionSchema, ExpressionSchema]).optional(),
});
export type DimensionLabel = z.infer<typeof DimensionLabelSchema>;

const baseComponentSchema = z.object({
  id: z.string(),
  type: z.literal('slab'),
  name: z.string(),
  length: ExpressionSchema,
  depth: ExpressionSchema,
  thickness: ExpressionSchema,
  position: z.tuple([ExpressionSchema, ExpressionSchema, ExpressionSchema]),
  rotation: z.tuple([ExpressionSchema, ExpressionSchema, ExpressionSchema]).optional(),
  cutouts: z.array(CutoutSchema),
  dimensionLabels: z.array(DimensionLabelSchema).optional(),
});

export type SlabComponent = z.infer<typeof baseComponentSchema> & {
  children?: SlabComponent[] | undefined;
};

// `as any` is used below as a standard workaround in Zod when dealing with deeply nested
// or mutually recursive schemas to prevent TypeScript compiler instantiation depth errors,
// while keeping the external type signature (`z.ZodType<SlabComponent>`) intact.
export const SlabComponentSchema: z.ZodType<SlabComponent> = baseComponentSchema.extend({
  children: z.lazy(() => z.array(SlabComponentSchema)).optional(),
}) as any;

export const AssemblyVariableSchema = z.object({
  id: z.string(),
  label: z.string(),
  default: z.number(),
});

export const CameraViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.tuple([z.number(), z.number(), z.number()]),
  target: z.tuple([z.number(), z.number(), z.number()]),
  zoom: z.number(),
  isDefault: z.boolean(),
  cropBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).nullish()
});
export type CameraView = z.infer<typeof CameraViewSchema>;

export const AssemblyTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  variables: z.array(AssemblyVariableSchema),
  components: z.array(SlabComponentSchema),
  cameraViews: z.array(CameraViewSchema).optional(),
});
export type AssemblyTemplate = z.infer<typeof AssemblyTemplateSchema>;
