import { NextResponse } from 'next/server';

import { getTemplateBySlug } from '../../../../lib/api-client';
import {
  getTemplateRuntimeVersion,
  renderTemplateThroughRuntime,
  TemplateRuntimeError,
} from '../../../../lib/template-runtime-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_BODY_BYTES = 192 * 1024;
const MAX_SECTIONS = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * Render draft editor halaman Studio untuk template PACKAGE yang ter-pin.
 * Template bawaan tidak pernah dirender lewat runtime (slug bawaan ditolak), dan
 * runtime sendiri hanya melayani versi berstatus `published` di registry.
 */
export async function POST(request: Request) {

  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!host) {
    return jsonResponse({ error: { code: 'invalid_origin', message: 'Origin pratinjau tidak diizinkan.' } }, 403);
  }
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProtocol || new URL(request.url).protocol.slice(0, -1);
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(`${protocol}://${host}`).origin;
  } catch {
    return jsonResponse({ error: { code: 'invalid_origin', message: 'Origin pratinjau tidak diizinkan.' } }, 403);
  }
  if (!origin || origin !== expectedOrigin) {
    return jsonResponse({ error: { code: 'invalid_origin', message: 'Origin pratinjau tidak diizinkan.' } }, 403);
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'invalid_content_type', message: 'Data pratinjau harus berupa JSON.' } }, 415);
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: { code: 'request_too_large', message: 'Data pratinjau melebihi batas.' } }, 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return jsonResponse({ error: { code: 'invalid_request', message: 'Data pratinjau tidak dapat dibaca.' } }, 400);
  }
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return jsonResponse({ error: { code: 'request_too_large', message: 'Data pratinjau melebihi batas.' } }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: { code: 'invalid_json', message: 'Data pratinjau harus berupa JSON.' } }, 400);
  }
  if (!isRecord(body) || typeof body.slug !== 'string' || typeof body.version !== 'string' || !isRecord(body.props)) {
    return jsonResponse({ error: { code: 'invalid_request', message: 'Slug, versi, dan props pratinjau wajib diisi.' } }, 400);
  }
  const sectionsValid = Array.isArray(body.props.sections) &&
    body.props.sections.length <= MAX_SECTIONS &&
    body.props.sections.every((section) =>
      isRecord(section) &&
      (section.id === undefined || (typeof section.id === 'string' && section.id.length <= 128)) &&
      typeof section.type === 'string' &&
      section.type.length > 0 &&
      section.type.length <= 128 &&
      isRecord(section.content),
    );
  if (body.props.isPreview !== true || !sectionsValid) {
    return jsonResponse({ error: { code: 'invalid_preview_props', message: 'Props pratinjau tidak valid.' } }, 400);
  }

  const template = await getTemplateBySlug(body.slug).catch(() => null);
  if (!template || template.source !== 'package') {
    return jsonResponse({ error: { code: 'runtime_version_not_approved', message: 'Hanya template package yang dirender lewat runtime.' } }, 403);
  }
  let approvedVersion: string | null;
  try {
    approvedVersion = getTemplateRuntimeVersion(body.slug, body.version);
  } catch (error) {
    if (error instanceof TemplateRuntimeError) {
      return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
    }
    throw error;
  }
  if (!approvedVersion) {
    return jsonResponse({ error: { code: 'runtime_version_not_approved', message: 'Versi template tidak diizinkan untuk pratinjau.' } }, 403);
  }

  const safeProps = Object.fromEntries(
    Object.entries(body.props).filter(([key]) => key !== 'auth'),
  );
  try {
    const rendered = await renderTemplateThroughRuntime({
      slug: body.slug,
      version: approvedVersion,
      props: safeProps,
    });
    // Pratinjau inert: client bundle tidak dikirim/dijalankan di editor.
    return jsonResponse({
      slug: rendered.slug,
      version: rendered.version,
      digest: rendered.digest,
      html: rendered.html,
    }, 200);
  } catch (error) {
    if (error instanceof TemplateRuntimeError) {
      return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
    }
    throw error;
  }
}
