import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Вэб хувилбарын HTML бүрхүүл. Зөвхөн вэб дээр ажиллана —
 * iOS/Android аппад нөлөөлөхгүй.
 *
 * Энд бичсэн шошгууд нь «Home Screen дээр нэмэх» үед аппын дүрс,
 * нэр зөв гарч, хаягийн мөргүй бүтэн дэлгэцээр нээгдэхэд хэрэгтэй.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="mn">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover — iPhone-ы хиймэл хилэн (notch) хүртэл дүүргэнэ */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        <title>Цай хураах</title>
        <meta name="description" content="Монгол даалуу — 5 тоглогчтой цай хураах тоглоом." />

        {/* Дэлгэц дээр нэмэхэд аппын дүрс, нэр */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="Цай хураах" />
        <meta name="application-name" content="Цай хураах" />

        {/* Хаягийн мөргүй, бүтэн дэлгэцээр нээгдэнэ */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#20150D" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
        {/* Оффлайн ажиллуулах Service Worker (production build-д л sw.js байна) */}
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTER }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const SW_REGISTER = `
// Expo dev server дээр sw.js байхгүй тул бүртгэл чимээгүй алгасагдана
if ("serviceWorker" in navigator) {
  // Шинэ хувилбарын SW идэвхжмэгц хуучин JS-тэй үлдэхгүйн тулд нэг удаа дахин ачаална.
  // Анх суулгах үед (өмнө нь controller байгаагүй) дахин ачаалахгүй.
  var hadController = !!navigator.serviceWorker.controller;
  var reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    // Анхны суулгалт: хуудас SW-ийн хяналтад орлоо гэж тэмдэглээд л өнгөрнө
    if (!hadController) { hadController = true; return; }
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").then(function (reg) {
      // Апп-ыг дахин нээх / буцаж ирэх бүрт шинэ хувилбар шалгана
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") reg.update().catch(function () {});
      });
    }).catch(function () {});
  });
}
`;

const BASE_CSS = `
/* Ачаалахаас өмнөх цагаан анивчилтыг арилгана */
html, body { background-color: #20150D; }

/* Бүтэн дэлгэц: хаягийн мөр гарч/алга болоход ч яг харагдах өндөр (dvh).
   100vh нь iOS дээр хаягийн мөрийн ард орж, доод хэсэг таслагддаг. */
html, body, #root { width: 100%; height: 100%; margin: 0; }
@supports (height: 100dvh) {
  html, body, #root { height: 100dvh; }
}
/* iOS-ийн суулгасан PWA (black-translucent) дээр 100%/dvh нь status bar-ын
   хэмжээгээр богино тооцогдож доод талд зай үлдээдэг — fixed + inset:0 нь
   яг физик дэлгэцийг хучна */
#root { position: fixed; top: 0; right: 0; bottom: 0; left: 0; height: auto; }

/* Тоглоомын дунд хуудас чирэгдэж, дахин ачаалахаас сэргийлнэ */
html, body {
  overscroll-behavior: none;
  -webkit-tap-highlight-color: transparent;
}

/* Мод удаан дарахад гарч ирдэг систем цэсийг хаана */
body { -webkit-touch-callout: none; }
`;
