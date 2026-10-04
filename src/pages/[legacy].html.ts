import type { APIRoute, GetStaticPaths } from 'astro';
import redirects from '@/data/redirects.json';

export const getStaticPaths: GetStaticPaths = () => Object.entries(redirects).map(([from, to]) => ({
  params: { legacy: from.slice(1, -5) },
  props: { to },
}));

// Static redirect documents work on GitHub Pages and plain file hosts.
export const GET: APIRoute = ({ props, site }) => new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Redirecting…</title>
<link rel="canonical" href="${new URL(props.to, site)}">
<meta http-equiv="refresh" content="0; url=${props.to}">
</head><body><p>Redirecting to <a href="${props.to}">${props.to}</a>.</p></body></html>`, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});
