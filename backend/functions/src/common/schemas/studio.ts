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
});

export type SlabComponent = z.infer<typeof baseComponentSchema> & {
  children?: SlabComponent[] | undefined;
};

export const SlabComponentSchema: z.ZodType<SlabComponent> = baseComponentSchema.extend({
  children: z.lazy(() => z.array(SlabComponentSchema)).optional(),
});

export const AssemblyVariableSchema = z.object({
  id: z.string(),
  label: z.string(),
  default: z.number(),
});

export const AssemblyTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  variables: z.array(AssemblyVariableSchema),
  components: z.array(SlabComponentSchema),
});
export type AssemblyTemplate = z.infer<typeof AssemblyTemplateSchema>;
