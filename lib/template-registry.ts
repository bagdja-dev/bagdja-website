import type { ComponentType } from 'react';

import { BarberClassicView, type BarberClassicViewProps } from '../components/templates/barber-classic-view';

export type TemplateRenderProps = BarberClassicViewProps;

const TEMPLATE_REGISTRY: Record<string, ComponentType<TemplateRenderProps>> = {
  'barber-classic': BarberClassicView,
};

export function getTemplateRenderer(templateSlug: string): ComponentType<TemplateRenderProps> | null {
  return TEMPLATE_REGISTRY[templateSlug] ?? null;
}
