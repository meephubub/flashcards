import Script from 'next/script';

export default function TestPage() {
  return (
    <>
      <div
        data-us-project="JiStzweZCWUmpL7ERFH6"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
        }}
      />
      <Script
        id="unicornstudio-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: `!function(){if(!window.UnicornStudio){window.UnicornStudio={isInitialized:!1};var i=document.createElement("script");i.src="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js",i.onload=function(){window.UnicornStudio.isInitialized||(UnicornStudio.init(),window.UnicornStudio.isInitialized=!0)},(document.head || document.body).appendChild(i)}}();` }}
      />
    </>
  );
}
