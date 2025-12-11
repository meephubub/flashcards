// app/api/embedproxy/route.ts
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function getBaseUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

// JavaScript to inject that prevents frame detection and redirects
const antiFrameBustingScript = `
<script>
(function() {
  // Override top and parent to prevent frame detection
  try {
    Object.defineProperty(window, 'top', { get: function() { return window; } });
    Object.defineProperty(window, 'parent', { get: function() { return window; } });
    Object.defineProperty(window, 'frameElement', { get: function() { return null; } });
  } catch(e) {}
  
  // Prevent location changes
  var origLocation = window.location;
  var locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
  
  // Block any navigation attempts
  window.addEventListener('beforeunload', function(e) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  });
  
  // Override window.open to prevent popups/redirects
  window.open = function() { return null; };
  
  // Block click handlers that try to navigate
  document.addEventListener('click', function(e) {
    var target = e.target;
    while (target && target !== document.body) {
      if (target.tagName === 'A' && target.href && !target.href.includes('javascript:')) {
        var href = target.getAttribute('href');
        // Allow video controls and hash links
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          // Check if this looks like an ad/redirect link
          if (target.target === '_blank' || href.includes('redirect') || href.includes('click')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }
      }
      target = target.parentElement;
    }
  }, true);
  
  // Intercept createElement to prevent ad injection
  var origCreate = document.createElement.bind(document);
  document.createElement = function(tag) {
    var el = origCreate(tag);
    if (tag.toLowerCase() === 'script') {
      // Allow but monitor
    }
    return el;
  };
  
  console.log('[Proxy] Anti-frame-busting protections active');
})();
</script>
`;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const spoof = req.nextUrl.searchParams.get('spoof') === '1';

  if (!url) return new Response('Missing url parameter', { status: 400 });

  try {
    const baseUrl = getBaseUrl(url);

    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    if (spoof) {
      headers['Referer'] = baseUrl + '/';
      headers['Origin'] = baseUrl;
    }

    const res = await fetch(url, {
      headers,
      redirect: 'follow',
    });

    if (!res.ok) {
      return new Response(`Upstream error: ${res.status}`, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'text/html';
    let body: string | ArrayBuffer;

    if (contentType.includes('text/html')) {
      body = await res.text();

      // Inject base tag for relative URLs
      const baseTag = `<base href="${baseUrl}/">`;

      // Insert our anti-frame-busting script as early as possible
      if (body.includes('<head>')) {
        body = body.replace('<head>', `<head>${baseTag}${antiFrameBustingScript}`);
      } else if (body.includes('<HEAD>')) {
        body = body.replace('<HEAD>', `<HEAD>${baseTag}${antiFrameBustingScript}`);
      } else if (body.includes('<html>') || body.includes('<HTML>')) {
        body = body.replace(/<html>/i, `<html><head>${baseTag}${antiFrameBustingScript}</head>`);
      } else {
        body = `<head>${baseTag}${antiFrameBustingScript}</head>` + body;
      }

      // Remove/neutralize frame-busting code patterns
      body = body
        // Neutralize top !== self checks
        .replace(/if\s*\(\s*top\s*!==?\s*self\s*\)/gi, 'if(false)')
        .replace(/if\s*\(\s*self\s*!==?\s*top\s*\)/gi, 'if(false)')
        .replace(/if\s*\(\s*window\.top\s*!==?\s*window\.self\s*\)/gi, 'if(false)')
        .replace(/if\s*\(\s*window\.self\s*!==?\s*window\.top\s*\)/gi, 'if(false)')
        .replace(/if\s*\(\s*parent\s*!==?\s*self\s*\)/gi, 'if(false)')
        .replace(/if\s*\(\s*window\s*!==?\s*window\.top\s*\)/gi, 'if(false)')
        // Comment out location redirects
        .replace(/top\.location\s*=/g, '//blocked//')
        .replace(/parent\.location\s*=/g, '//blocked//')
        .replace(/window\.top\.location\s*=/g, '//blocked//')
        .replace(/self\.location\s*=\s*top\.location/gi, '//blocked//')
        // Neutralize break-out-of-frame attempts
        .replace(/top\.location\.href\s*=/g, '//blocked//')
        .replace(/top\.location\.replace/g, '(function(){})')
        // Remove inline onclick handlers that might redirect
        .replace(/onclick="[^"]*location[^"]*"/gi, 'onclick=""')
        .replace(/onclick='[^']*location[^']*'/gi, "onclick=''");

    } else {
      body = await res.arrayBuffer();
    }

    const responseHeaders = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': "frame-ancestors *;",
    });

    return new Response(body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('Proxy error:', err);
    return new Response('Stream unreachable or blocked', { status: 502 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}