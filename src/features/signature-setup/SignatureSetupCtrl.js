(function () {
  'use strict';

  angular
    .module('SignModule')
    .controller('SignatureSetupCtrl', [
      '$scope',
      '$rootScope',
      '$state',
      '$stateParams',
      '$location',
      '$mdSidenav',
      '$mdMedia',
      'SignatureRequestService',
      'UserProfileService',
      'ClientAnrService',
      'PdfCoordinateHelper',
      'toastr',
      'gettextCatalog',
      function ($scope, $rootScope, $state, $stateParams, $location, $mdSidenav, $mdMedia, SignatureRequestService, UserProfileService, ClientAnrService, PdfCoordinateHelper, toastr, gettextCatalog) {
        try {
          if ($mdSidenav && $mdSidenav('left')) {
            $mdSidenav('left').close();
          }
        } catch (e) {}
        if ($scope.$parent) {
          $scope.$parent.sidenavIsOpen = false;
        }

        $scope.$on('$destroy', function () {
          if ($mdMedia && $mdMedia('gt-md') && $scope.$parent) {
            $scope.$parent.sidenavIsOpen = true;
          }
        });

        $scope.modelId = parseInt($stateParams.modelId || $rootScope.getUrlAnrId(), 10);
        $scope.requestId = ($stateParams && $stateParams.requestId) ? parseInt($stateParams.requestId, 10) : null;
        if (!$scope.requestId) {
          toastr.error(gettextCatalog.getString("Missing signature request identifier."));
        }

        if ($scope.modelId && ClientAnrService) {
          ClientAnrService.getAnr($scope.modelId).then(function (anrData) {
            $rootScope.model = $rootScope.model || {};
            $rootScope.model.anr = anrData;
          }).catch(function () {
            $rootScope.model = $rootScope.model || {};
            $rootScope.model.anr = { id: $scope.modelId, label: gettextCatalog.getString('Risk analysis #') + $scope.modelId };
          });
        }

        $scope.pdfState = {
          currentPage: 1,
          totalPages: 1,
          scale: 1.0
        };
        $scope.currentPage = 1;
        $scope.totalPages = 1;
        $scope.scale = 1.0;
        $scope.isLoading = true;
        $scope.signatories = [];
        $scope.selectedSignatory = null;
        $scope.currentUserId = null;
        $scope.isSaving = false;
        $scope.isLaunching = false;
        var _signatoryIdCounter = 0;

        var colors = [
          { main: '#006fba', bg: 'rgba(0, 111, 186, 0.08)' }, // Bleu MONARC
          { main: '#2e7d32', bg: 'rgba(46, 125, 50, 0.08)' },  // Vert
          { main: '#e65100', bg: 'rgba(230, 81, 0, 0.08)' },   // Orange
          { main: '#6a1b9a', bg: 'rgba(106, 27, 154, 0.08)' }, // Violet
          { main: '#c2185b', bg: 'rgba(194, 24, 91, 0.08)' },  // Rose
        ];

        function loadData() {
          $scope.isLoading = true;

          var profilePromise = (UserProfileService && UserProfileService.getProfile)
            ? UserProfileService.getProfile().then(function (profile) {
                var user = (profile && profile.user) ? profile.user : profile;
                if (user && user.id) {
                  $scope.currentUserId = user.id;
                }
                return user;
              }).catch(function () {
                return null;
              })
            : Promise.resolve(null);

          if ($scope.requestId && $scope.requestId !== 'new') {
            $scope.pdfUrl = SignatureRequestService.getPdfUrl($scope.requestId);

            Promise.resolve(profilePromise).then(function (user) {
              return SignatureRequestService.getSignatureRequest($scope.modelId, $scope.requestId);
            }).then(function (res) {
              var data = res.request || res;
              if (data.signatories && data.signatories.length > 0) {
                $scope.signatories = data.signatories.map(function (s, idx) {
                  var colorPair = colors[idx % colors.length];
                  var cX = (s.coordX !== undefined && s.coordX !== null) ? s.coordX : s.x;
                  var cY = (s.coordY !== undefined && s.coordY !== null) ? s.coordY : s.y;

                  return {
                    id: s.id || (idx + 1),
                    user: s.user || (s.userId ? { id: s.userId, firstname: s.userName || s.userFirstname, lastname: s.userLastname, email: s.userEmail } : null),
                    order: s.order || (idx + 1),
                    page: parseInt(s.page || s.pageNumber || 1, 10),
                    coordX: cX,
                    coordY: cY,
                    x: cX,
                    y: cY,
                    width: s.width,
                    height: s.height,
                    color: colorPair.main,
                    bgColor: colorPair.bg
                  };
                });
                _signatoryIdCounter = $scope.signatories.reduce(function (max, s) { return Math.max(max, s.id || 0); }, 0);
                updateScreenPositions();
                $scope.selectedSignatory = $scope.signatories[0];
              } else {
                initConnectedUser();
              }
              $scope.isLoading = false;
            }).catch(function (err) {
              console.error('Erreur chargement signature setup:', err);
              initConnectedUser();
              $scope.isLoading = false;
            });
          } else {
            Promise.resolve(profilePromise).then(function (user) {
              initConnectedUser(user);
              $scope.isLoading = false;
            });
          }
        }

        function initConnectedUser(preloadedUser) {
          if (preloadedUser) {
            $scope.addSignatoryWithUser(preloadedUser);
          } else if (UserProfileService && UserProfileService.getProfile) {
            UserProfileService.getProfile().then(
              function (profile) {
                var user = (profile && profile.user) ? profile.user : profile;
                if (user && user.id) {
                  $scope.currentUserId = user.id;
                }
                $scope.addSignatoryWithUser(user);
              },
              function () {
                $scope.addEmptySignatory();
              }
            );
          } else {
            $scope.addEmptySignatory();
          }
        }

        $scope.addSignatoryWithUser = function (user) {
          var index = $scope.signatories.length;
          var colorPair = colors[index % colors.length];

          var newSig = {
            id: ++_signatoryIdCounter,
            user: user,
            order: index + 1,
            page: $scope.currentPage || 1,
            x: 100 + (index * 20),
            y: 150 + (index * 40),
            width: 180,
            height: 60,
            color: colorPair.main,
            bgColor: colorPair.bg
          };

          $scope.signatories.push(newSig);
          $scope.selectSignatory(newSig);
        };

        $scope.addEmptySignatory = function () {
          var index = $scope.signatories.length;
          var colorPair = colors[index % colors.length];

          var newSig = {
            id: ++_signatoryIdCounter,
            user: null,
            order: index + 1,
            page: $scope.currentPage || 1,
            x: 120,
            y: 200,
            width: 180,
            height: 60,
            color: colorPair.main,
            bgColor: colorPair.bg
          };

          $scope.signatories.push(newSig);
          $scope.selectSignatory(newSig);
        };

        $scope.removeSignatory = function (sig) {
          var index = $scope.signatories.indexOf(sig);
          if (index !== -1) {
            $scope.signatories.splice(index, 1);
            $scope.recalculateOrder();
            $scope.selectedSignatory = $scope.signatories[0] || null;
          }
        };

        $scope.selectSignatory = function (sig) {
          $scope.selectedSignatory = sig;
          if (sig && (sig.page !== undefined && sig.page !== null)) {
            var targetPage = parseInt(sig.page, 10) || 1;
            $scope.pdfState.currentPage = targetPage;
            $scope.currentPage = targetPage;
          }
        };

        // Géométrie de la page demandée (cache par-page sinon page affichée)
        function getPageGeometry(pageNum) {
          var p = parseInt(pageNum, 10) || 1;
          var pages = $scope.pdfState && $scope.pdfState.pages;
          if (pages && pages[p] && pages[p].pageWidth && pages[p].pageHeight) {
            return {
              pageWidth: pages[p].pageWidth,
              pageHeight: pages[p].pageHeight,
              rotation: pages[p].rotation || 0
            };
          }
          if ($scope.pdfState && $scope.pdfState.pageWidth && $scope.pdfState.pageHeight
              && (p === (parseInt($scope.pdfState.currentPage, 10) || 1))) {
            return {
              pageWidth: $scope.pdfState.pageWidth,
              pageHeight: $scope.pdfState.pageHeight,
              rotation: $scope.pdfState.rotation || 0
            };
          }
          return null;
        }

        function updateScreenPositions() {
          if (!$scope.signatories) {
            return;
          }
          $scope.signatories.forEach(function (s) {
            if (s._dirty) {
              return;
            }
            if (s.coordX === undefined || s.coordX === null || s.coordY === undefined || s.coordY === null || !s.width || !s.height) {
              return;
            }
            var geo = getPageGeometry(s.page);
            if (!geo) {
              return;
            }
            try {
              var screenCoords = PdfCoordinateHelper.convertPdfToScreenCoords({
                pdfX: s.coordX,
                pdfY: s.coordY,
                pdfWidth: s.width,
                pdfHeight: s.height,
                pageWidth: geo.pageWidth,
                pageHeight: geo.pageHeight,
                rotation: geo.rotation
              });
              s.x = screenCoords.x;
              s.y = screenCoords.y;
            } catch (e) {}
          });
        }

        $scope.$watchGroup(
          ['pdfState.pageWidth', 'pdfState.pageHeight', 'pdfState.rotation', 'pdfState.pagesVersion'],
          function () {
            updateScreenPositions();
          }
        );

        $scope.recalculateOrder = function () {
          $scope.signatories.forEach(function (sig, idx) {
            sig.order = idx + 1;
          });
        };

        $scope.zoomIn = function () {
          $scope.pdfState.scale = Math.min(2.0, parseFloat(((Number($scope.pdfState.scale) || 1.0) + 0.15).toFixed(2)));
          $scope.scale = $scope.pdfState.scale;
        };

        $scope.zoomOut = function () {
          $scope.pdfState.scale = Math.max(0.6, parseFloat(((Number($scope.pdfState.scale) || 1.0) - 0.15).toFixed(2)));
          $scope.scale = $scope.pdfState.scale;
        };

        $scope.prevPage = function () {
          var cur = parseInt($scope.pdfState.currentPage, 10) || 1;
          if (cur > 1) {
            $scope.pdfState.currentPage = cur - 1;
            $scope.currentPage = $scope.pdfState.currentPage;
          }
        };

        $scope.nextPage = function () {
          var cur = parseInt($scope.pdfState.currentPage, 10) || 1;
          var total = parseInt($scope.pdfState.totalPages, 10) || parseInt($scope.totalPages, 10) || 1;
          if (cur < total) {
            $scope.pdfState.currentPage = cur + 1;
            $scope.currentPage = $scope.pdfState.currentPage;
          }
        };

        $scope.goToPage = function (p) {
          var num = parseInt(p, 10);
          var total = parseInt($scope.pdfState.totalPages, 10) || parseInt($scope.totalPages, 10) || 1;
          if (!isNaN(num) && num >= 1 && num <= total) {
            $scope.pdfState.currentPage = num;
            $scope.currentPage = num;
          }
        };

        $scope.onPageInputChange = function () {
          var p = parseInt($scope.pdfState.currentPage, 10);
          var total = parseInt($scope.pdfState.totalPages, 10) || parseInt($scope.totalPages, 10) || 1;
          if (!isNaN(p) && p >= 1 && p <= total) {
            $scope.pdfState.currentPage = p;
            $scope.currentPage = p;
          }
        };

        $scope.onPageInputBlur = function () {
          var p = parseInt($scope.pdfState.currentPage, 10);
          var total = parseInt($scope.pdfState.totalPages, 10) || parseInt($scope.totalPages, 10) || 1;
          if (isNaN(p) || p < 1) {
            $scope.pdfState.currentPage = 1;
          } else if (p > total) {
            $scope.pdfState.currentPage = total;
          }
          $scope.currentPage = $scope.pdfState.currentPage;
        };

        $scope.goToList = function () {
          $state.go('main.project.anr.signatureList', { modelId: $scope.modelId });
        };

        // Valide la configuration des signataires puis démarre le processus de signature
        $scope.saveAndStartProcess = function () {
          if (!$scope.signatories || !$scope.signatories.length) {
            toastr.warning(gettextCatalog.getString('Please add at least one signatory.'));
            return;
          }

          if (!$scope.pdfState.pageWidth || !$scope.pdfState.pageHeight) {
            toastr.error(gettextCatalog.getString("The PDF document is not fully loaded yet or its dimensions could not be found."));
            return;
          }

          if (!$scope.pdfState.pagesReady) {
            toastr.warning(gettextCatalog.getString("The PDF document is still being analyzed. Please try again in a moment."));
            return;
          }

          for (var i = 0; i < $scope.signatories.length; i++) {
            var sig = $scope.signatories[i];
            var uId = (sig.user && sig.user.id) ? sig.user.id : (sig.userId || null);
            if (!uId) {
              toastr.warning(gettextCatalog.getString('Please assign a user for signatory #') + (i + 1));
              return;
            }
            if (sig.x === undefined || sig.x === null || sig.y === undefined || sig.y === null || !sig.width || !sig.height) {
              toastr.error(gettextCatalog.getString('The signature coordinates for signatory #') + (i + 1) + " " + gettextCatalog.getString('are incomplete.'));
              return;
            }
          }

          $scope.isSaving = true;
          var payload;
          try {
            payload = $scope.signatories.map(function (s, idx) {
              var userId = (s.user && s.user.id) ? s.user.id : (s.userId || null);

              var geo = getPageGeometry(s.page);
              if (!geo) {
                throw new Error(gettextCatalog.getString("Dimensions of page") + " " + (s.page || 1) + " " + gettextCatalog.getString("not found for signatory #") + (idx + 1) + ".");
              }

              var pdfCoords = PdfCoordinateHelper.convertScreenToPdfCoords({
                screenX: s.x,
                screenY: s.y,
                screenWidth: s.width,
                screenHeight: s.height,
                pageWidth: geo.pageWidth,
                pageHeight: geo.pageHeight,
                rotation: geo.rotation
              });

              return {
                userId: userId,
                order: s.order || 1,
                page: s.page || 1,
                x: pdfCoords.x,
                y: pdfCoords.y,
                width: pdfCoords.width,
                height: pdfCoords.height
              };
            });
          } catch (err) {
            $scope.isSaving = false;
            toastr.error(err.message || gettextCatalog.getString('Error while computing coordinates.'));
            return;
          }

          SignatureRequestService.updateSignatories($scope.modelId, $scope.requestId, payload)
            .then(function () {
              $scope.isSaving = false;
              toastr.success(gettextCatalog.getString('Signatories configuration saved successfully.'));
              $state.go('main.project.anr.signatureList', { modelId: $scope.modelId });
            })
            .catch(function (err) {
              $scope.isSaving = false;
              var msg = (err && err.data && err.data.error) ? err.data.error : (err && err.statusText ? err.statusText : gettextCatalog.getString('Error while saving'));
              toastr.error(msg);
            });
        };

        $scope.launchSignature = $scope.saveAndStartProcess;

        loadData();
      },
    ]);
})();