(function () {
  'use strict';

  angular
    .module('SignModule')
    .directive('pdfViewer', [
      'SignatureProcessService',
      function (SignatureProcessService) {
        return {
          restrict: 'E',
          transclude: true,
          scope: {
            pdfUrl: '=',
            currentPage: '=',
            totalPages: '=',
            scale: '=',
            pdfState: '=?',
          },
          template: '<div class="pdf-viewer-wrapper">' +
                    '  <div class="pdf-page-container" id="pdf-page-container">' +
                    '    <canvas id="pdf-canvas" style="display:block;"></canvas>' +
                    '    <div class="pdf-overlay" ng-transclude></div>' +
                    '  </div>' +
                    '</div>',
          link: function (scope, element) {
            var pdfDoc = null;
            var canvas = element[0].querySelector('canvas') || (element.find('canvas') && element.find('canvas')[0]);
            var container = element[0].querySelector('.pdf-page-container');
            var overlay = element[0].querySelector('.pdf-overlay');

            function getTargetState() {
              return scope.pdfState || (scope.$parent && scope.$parent.pdfState) || null;
            }

            // Pré-calcule les dimensions de toutes les pages du PDF
            function collectAllPageDimensions() {
              var targetState = getTargetState();
              if (!targetState || !pdfDoc) return;
              var total = pdfDoc.numPages || 1;
              var jobs = [];
              targetState.pages = targetState.pages || {};

              for (var i = 1; i <= total; i++) {
                (function (pageNum) {
                  jobs.push(
                    pdfDoc.getPage(pageNum).then(function (page) {
                      var vp = page.getViewport({ scale: 1.0 });
                      var rot = (page.rotate !== undefined)
                        ? page.rotate
                        : ((vp && vp.rotation !== undefined) ? vp.rotation : 0);
                      if (vp && vp.width && vp.height) {
                        targetState.pages[pageNum] = {
                          pageWidth: vp.width,
                          pageHeight: vp.height,
                          rotation: rot
                        };
                      }
                    }).catch(function () {})
                  );
                })(i);
              }

              Promise.all(jobs).then(function () {
                scope.$applyAsync(function () {
                  targetState.pagesReady = true;
                  targetState.pagesVersion = (targetState.pagesVersion || 0) + 1;
                });
              });
            }

            function loadPdfJsScript() {
              if (window.pdfjsLib) {
                initPdf();
                return;
              }
              var script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
              script.onload = function () {
                if (window.pdfjsLib) {
                  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                }
                initPdf();
              };
              document.head.appendChild(script);
            }

            function initPdf() {
              if (!scope.pdfUrl || !window.pdfjsLib || !canvas) return;
              
              SignatureProcessService.loadPdfData(scope.pdfUrl)
                .then(function (data) {
                  return window.pdfjsLib.getDocument({ data: data }).promise;
                })
                .then(function (pdf) {
                  pdfDoc = pdf;
                  var total = pdf.numPages || 1;
                  var initialPage = parseInt(scope.currentPage, 10) || 1;
                  if (initialPage > total || initialPage < 1) {
                    initialPage = 1;
                  }
                  if (!scope.$$phase && !scope.$root.$$phase) {
                    scope.$apply(function () {
                      scope.totalPages = total;
                      scope.currentPage = initialPage;
                    });
                  } else {
                    scope.totalPages = total;
                    scope.currentPage = initialPage;
                  }
                  collectAllPageDimensions();
                  renderPage(initialPage);
              }).catch(function (err) {
                console.error('[PdfViewerDirective] Erreur chargement PDF:', err);
              });
            }

            var renderTask = null;

            function renderPage(pageNum) {
              if (!pdfDoc || !canvas) {
                return;
              }
              var pageIndex = parseInt(pageNum, 10);
              if (isNaN(pageIndex) || pageIndex < 1) {
                pageIndex = 1;
              } else if (pdfDoc.numPages && pageIndex > pdfDoc.numPages) {
                pageIndex = pdfDoc.numPages;
              }

              if (renderTask) {
                renderTask.cancel();
                renderTask = null;
              }

              pdfDoc.getPage(pageIndex).then(function (page) {
                var currentScale = parseFloat(scope.scale) || 1.0;
                var viewport = page.getViewport({ scale: currentScale });
                var unscaledVp = page.getViewport({ scale: 1.0 });

                var pWidth = (unscaledVp && unscaledVp.width) ? unscaledVp.width : null;
                var pHeight = (unscaledVp && unscaledVp.height) ? unscaledVp.height : null;
                var pRot = (page.rotate !== undefined) ? page.rotate : ((unscaledVp && unscaledVp.rotation) !== undefined ? unscaledVp.rotation : 0);

                var targetState = getTargetState();
                if (targetState && pWidth && pHeight) {
                  targetState.pageWidth = pWidth;
                  targetState.pageHeight = pHeight;
                  targetState.rotation = pRot;
                  targetState.pages = targetState.pages || {};
                  targetState.pages[pageIndex] = {
                    pageWidth: pWidth,
                    pageHeight: pHeight,
                    rotation: pRot
                  };
                }

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                if (container) {
                  container.style.width = viewport.width + 'px';
                  container.style.height = viewport.height + 'px';
                }
                if (overlay) {
                  overlay.style.width = viewport.width + 'px';
                  overlay.style.height = viewport.height + 'px';
                }

                var renderContext = {
                  canvasContext: canvas.getContext('2d'),
                  viewport: viewport,
                };

                renderTask = page.render(renderContext);
                renderTask.promise.then(function () {
                  renderTask = null;
                }).catch(function (err) {
                  if (!err || err.name !== 'RenderingCancelledException') {
                    console.error('[PdfViewerDirective] Erreur rendu page PDF:', err);
                  }
                  renderTask = null;
                });
              }).catch(function (err) {
                console.error('[PdfViewerDirective] Erreur getPage PDF:', err);
              });
            }

            scope.$watch('currentPage', function (newVal, oldVal) {
              if (newVal !== undefined && newVal !== null && newVal !== '') {
                renderPage(newVal);
              }
            });

            scope.$watch('scale', function (newVal, oldVal) {
              if (newVal !== undefined && newVal !== null) {
                renderPage(scope.currentPage || 1);
              }
            });

            scope.$watch('pdfUrl', function (newVal) {
              if (newVal) loadPdfJsScript();
            });

            loadPdfJsScript();
          },
        };
      },
    ]);
})();