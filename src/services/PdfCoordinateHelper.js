(function () {
  'use strict';

  angular
    .module('SignModule')
    .service('PdfCoordinateHelper', [
      function () {
        function normalizeRotation(value) {
          var raw = (value !== undefined && value !== null) ? Number(value) : 0;
          if (isNaN(raw)) {
            throw new Error("L'angle de rotation de la page PDF est invalide.");
          }
          return ((raw % 360) + 360) % 360;
        }

        function round2(n) {
          return Math.round(n * 100) / 100;
        }

        // Convertit des coordonnées écran (overlay HTML, échelle 1) en coordonnées PDF natives
        this.convertScreenToPdfCoords = function (params) {
          if (!params) {
            throw new Error("Les paramètres de conversion de coordonnées PDF sont manquants.");
          }

          if (params.screenX === undefined || params.screenX === null || isNaN(Number(params.screenX))) {
            throw new Error("La coordonnée X de la signature est manquante ou invalide.");
          }
          if (params.screenY === undefined || params.screenY === null || isNaN(Number(params.screenY))) {
            throw new Error("La coordonnée Y de la signature est manquante ou invalide.");
          }
          if (params.screenWidth === undefined || params.screenWidth === null || isNaN(Number(params.screenWidth)) || Number(params.screenWidth) <= 0) {
            throw new Error("La largeur de la signature est manquante ou invalide.");
          }
          if (params.screenHeight === undefined || params.screenHeight === null || isNaN(Number(params.screenHeight)) || Number(params.screenHeight) <= 0) {
            throw new Error("La hauteur de la signature est manquante ou invalide.");
          }

          if (params.pageWidth === undefined || params.pageWidth === null || isNaN(Number(params.pageWidth)) || Number(params.pageWidth) <= 0) {
            throw new Error("La largeur réelle de la page PDF est introuvable ou invalide.");
          }
          if (params.pageHeight === undefined || params.pageHeight === null || isNaN(Number(params.pageHeight)) || Number(params.pageHeight) <= 0) {
            throw new Error("La hauteur réelle de la page PDF est introuvable ou invalide.");
          }

          var scale = Number(params.scale);
          if (isNaN(scale) || scale <= 0) {
            scale = 1;
          }

          var rawX = Number(params.screenX) / scale;
          var rawY = Number(params.screenY) / scale;
          var rawW = Number(params.screenWidth) / scale;
          var rawH = Number(params.screenHeight) / scale;

          var pWidth = Number(params.pageWidth);
          var pHeight = Number(params.pageHeight);

          var rot = normalizeRotation(params.rotation);

          var finalX, finalY, finalW, finalH;

          switch (rot) {
            case 90:
              finalX = rawY;
              finalY = rawX;
              finalW = rawH;
              finalH = rawW;
              break;

            case 180:
              finalX = pWidth - (rawX + rawW);
              finalY = rawY;
              finalW = rawW;
              finalH = rawH;
              break;

            case 270:
              finalX = pHeight - (rawY + rawH);
              finalY = pWidth - (rawX + rawW);
              finalW = rawH;
              finalH = rawW;
              break;

            case 0:
            default:
              finalX = rawX;
              finalY = pHeight - (rawY + rawH);
              finalW = rawW;
              finalH = rawH;
              break;
          }

          finalX = Math.max(10.0, round2(finalX));
          finalY = Math.max(10.0, round2(finalY));
          finalW = round2(finalW);
          finalH = round2(finalH);

          return {
            x: finalX,
            y: finalY,
            width: finalW,
            height: finalH
          };
        };

        // Convertit des coordonnées PDF natives en coordonnées écran (overlay HTML, échelle 1)
        this.convertPdfToScreenCoords = function (params) {
          if (!params) {
            throw new Error("Les paramètres de conversion de coordonnées écran sont manquants.");
          }
          if (params.pdfX === undefined || params.pdfX === null || isNaN(Number(params.pdfX))) {
            throw new Error("La coordonnée PDF X est manquante.");
          }
          if (params.pdfY === undefined || params.pdfY === null || isNaN(Number(params.pdfY))) {
            throw new Error("La coordonnée PDF Y est manquante.");
          }
          if (params.pdfWidth === undefined || params.pdfWidth === null || isNaN(Number(params.pdfWidth))) {
            throw new Error("La largeur PDF est manquante.");
          }
          if (params.pdfHeight === undefined || params.pdfHeight === null || isNaN(Number(params.pdfHeight))) {
            throw new Error("La hauteur PDF est manquante.");
          }

          if (!params.pageWidth || isNaN(Number(params.pageWidth))) {
            throw new Error("La largeur de page PDF est manquante.");
          }
          if (!params.pageHeight || isNaN(Number(params.pageHeight))) {
            throw new Error("La hauteur de page PDF est manquante.");
          }

          var pdfX = Number(params.pdfX);
          var pdfY = Number(params.pdfY);
          var pdfW = Number(params.pdfWidth);
          var pdfH = Number(params.pdfHeight);

          var pWidth = Number(params.pageWidth);
          var pHeight = Number(params.pageHeight);

          var rot = normalizeRotation(params.rotation);

          var screenX, screenY, screenW, screenH;

          switch (rot) {
            case 90:
              screenX = pdfY;
              screenY = pdfX;
              screenW = pdfH;
              screenH = pdfW;
              break;

            case 180:
              screenX = pWidth - (pdfX + pdfW);
              screenY = pdfY;
              screenW = pdfW;
              screenH = pdfH;
              break;

            case 270:
              screenX = pHeight - (pdfX + pdfW);
              screenY = pWidth - (pdfY + pdfH);
              screenW = pdfH;
              screenH = pdfW;
              break;

            case 0:
            default:
              screenX = pdfX;
              screenY = pHeight - (pdfY + pdfH);
              screenW = pdfW;
              screenH = pdfH;
              break;
          }

          return {
            x: Math.max(0, round2(screenX)),
            y: Math.max(0, round2(screenY)),
            width: round2(screenW),
            height: round2(screenH)
          };
        };
      }
    ]);
})();
