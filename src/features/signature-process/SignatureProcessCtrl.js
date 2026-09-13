(function () {
  'use strict';

  angular
    .module('SignModule')
    .controller('SignatureProcessCtrl', [
      '$scope',
      '$rootScope',
      '$state',
      '$stateParams',
      '$location',
      '$window',
      '$mdDialog',
      '$timeout',
      '$mdSidenav',
      '$mdMedia',
      'SignatureProcessService',
      'BJeTokenService',
      'UserProfileService',
      'ClientAnrService',
      'PdfCoordinateHelper',
      'toastr',
      'gettextCatalog',
      function ($scope, $rootScope, $state, $stateParams, $location, $window, $mdDialog, $timeout, $mdSidenav, $mdMedia, SignatureProcessService, BJeTokenService, UserProfileService, ClientAnrService, PdfCoordinateHelper, toastr, gettextCatalog) {
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
        $scope.model = $scope.model || {};
        $scope.rejectedFallbackMessage = gettextCatalog.getString('This document has been rejected by a signatory.');

        if ($scope.modelId && ClientAnrService) {
          ClientAnrService.getAnr($scope.modelId).then(function (anrData) {
            $rootScope.model = $rootScope.model || {};
            $rootScope.model.anr = anrData;
            $scope.model.anr = anrData;
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
        $scope.request = null;
        $scope.signatories = [];
        $scope.currentSignatory = null;
        $scope.connectedUser = null;
        $scope.isMyTurn = false;
        $scope.hasAlreadySigned = false;
        $scope.isStatusReady = false;
        $scope.signatureImage = null;
        $scope.isSigning = false;
        $scope.isRejecting = false;
        var hasInitializedPage = false;

        var colors = [
          { main: '#006fba', bg: 'rgba(0, 111, 186, 0.08)' },
          { main: '#2e7d32', bg: 'rgba(46, 125, 50, 0.08)' },
          { main: '#e65100', bg: 'rgba(230, 81, 0, 0.08)' },
          { main: '#6a1b9a', bg: 'rgba(106, 27, 154, 0.08)' },
          { main: '#c2185b', bg: 'rgba(194, 24, 91, 0.08)' },
        ];

        function updateTurnStatus() {
          if (!$scope.request || !$scope.signatories) return;
          var currentStep = $scope.request.currentStep || 1;
          $scope.currentSignatory = $scope.signatories.find(function (s) {
            return s.order === currentStep;
          });

          if (!hasInitializedPage && $scope.currentSignatory && $scope.currentSignatory.page) {
            $scope.currentPage = parseInt($scope.currentSignatory.page, 10) || 1;
            hasInitializedPage = true;
          }

          if ($scope.connectedUser && $scope.currentSignatory) {
            var connectedId = $scope.connectedUser.id;
            var sigUser = $scope.signatories.find(function (s) { return s.order === currentStep; });
            if (sigUser && sigUser.user && sigUser.user.id == connectedId && sigUser.status === 'pending') {
              $scope.isMyTurn = true;
            } else {
              $scope.isMyTurn = false;
            }

            var alreadySigned = $scope.signatories.some(function (s) {
              return s.user && s.user.id == connectedId && s.status === 'signed';
            });
            $scope.hasAlreadySigned = alreadySigned;
          } else {
            $scope.isMyTurn = false;
          }

          $scope.isStatusReady = true;
        }

        function loadData() {
          $scope.isLoading = true;
          $scope.isStatusReady = false;

          var profilePromise = (UserProfileService && UserProfileService.getProfile)
            ? UserProfileService.getProfile().then(function (profile) {
                $scope.connectedUser = (profile && profile.user) ? profile.user : profile;
              }).catch(function () {
                $scope.connectedUser = null;
              })
            : Promise.resolve(null);

          if ($scope.requestId) {
            $scope.pdfUrl = SignatureProcessService.getPdfUrl($scope.requestId);

            Promise.resolve(profilePromise).then(function () {
              return SignatureProcessService.getSignatureRequest($scope.modelId, $scope.requestId);
            }).then(function (res) {
              var data = res.request || res;
              $scope.request = data;
              $scope.signatories = (data.signatories || []).map(function (s, idx) {
                var colorPair = colors[idx % colors.length];
                var u = s.user || (s.userId ? { id: s.userId, firstname: s.userName || s.userFirstname, lastname: s.userLastname, email: s.userEmail } : {});
                var name = ((u.firstname || '') + ' ' + (u.lastname || '')).trim();

                var cX = (s.coordX !== undefined && s.coordX !== null) ? s.coordX : s.x;
                var cY = (s.coordY !== undefined && s.coordY !== null) ? s.coordY : s.y;

                return {
                  id: s.id || (idx + 1),
                  name: name || u.email || (gettextCatalog.getString('Signatory #') + (s.order || idx + 1)),
                  email: u.email || '',
                  user: u,
                  order: s.order || (idx + 1),
                  status: s.status || 'pending',
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

              updateScreenPositions();
              updateTurnStatus();
              checkNotifications();
              if (!maybeAutoResumeSign()) {
                $scope.isLoading = false;
              }
            }).catch(function (err) {
              console.error('Erreur chargement détails document:', err);
              toastr.error(gettextCatalog.getString('Unable to load the document data.'));
              $scope.isStatusReady = true;
              $scope.isLoading = false;
            });
          } else {
            toastr.error(gettextCatalog.getString('Missing document identifier.'));
            $scope.isLoading = false;
          }
        }

        // Géométrie de la page demandée : cache par-page (PdfViewerDirective) sinon page affichée.
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

        var _reloadedAfterSuccess = false;

        function checkNotifications() {
          var isSuccess = ($stateParams.signatureSuccess === '1' || window.location.href.indexOf('signatureSuccess=1') !== -1);
          if (isSuccess && !_reloadedAfterSuccess) {
            _reloadedAfterSuccess = true;
            toastr.success(gettextCatalog.getString('Congratulations! Your signature has been successfully applied to the document.'));
            $scope.pdfUrl = SignatureProcessService.getPdfUrl($scope.requestId);
            loadData();
          }

          var isPending = (window.location.href.indexOf('signaturePending=1') !== -1);
          if (isPending) {
            toastr.info(gettextCatalog.getString('Your signature has been recorded. The signed document will be available after SSO reauthentication.'), gettextCatalog.getString('Signature recorded'), { timeOut: 8000 });
          }

          var isCanceled = (window.location.href.indexOf('signatureStatus=cancel') !== -1 || window.location.href.indexOf('signatureStatus=canceled') !== -1);
          if (isCanceled) {
            toastr.info(gettextCatalog.getString('The signature procedure has been interrupted.'));
          }

          var isFailed = (window.location.href.indexOf('signatureStatus=failed') !== -1);
          if (isFailed) {
            toastr.warning(gettextCatalog.getString('The signature could not be completed on TrustedX. The document remains available, you can try again.'));
          }

          var hasError = (window.location.href.indexOf('signatureError=') !== -1);
          if (hasError) {
            var match = window.location.href.match(/signatureError=([^&]+)/);
            if (match && match[1]) {
              toastr.error(decodeURIComponent(match[1].replace(/\+/g, ' ')), gettextCatalog.getString('Signature error'));
            }
          }

          if (isSuccess || isPending || isCanceled || isFailed || hasError) {
            if ($location && $location.search) {
              $location.search('signatureSuccess', null);
              $location.search('signaturePending', null);
              $location.search('signatureStatus', null);
              $location.search('signatureError', null);
              $location.search('status', null);
            }
            if ($window && $window.history && $window.history.replaceState) {
              var cleanUrl = $window.location.href
                .replace(/([?&])(signatureSuccess|signaturePending|signatureStatus|signatureError|status)=[^&]*(&|$)/g, '$1')
                .replace(/[?&]+$/, '');
              $window.history.replaceState({}, document.title, cleanUrl);
            }
          }
        }

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

        $scope.triggerFileInput = function () {
          var input = document.getElementById('sig-file-upload');
          if (input) {
            input.value = '';
            input.click();
          }
        };

        $scope.onFileSelected = function (files) {
          $scope.handleSignatureImageUpload(files);
        };

        $scope.handleSignatureImageUpload = function (files) {
          if (!files || !files.length) return;
          var file = files[0];
          if (!file.type.match('image.*')) {
            toastr.error(gettextCatalog.getString('Please select a valid image file (PNG, JPEG).'));
            return;
          }
          var reader = new FileReader();
          reader.onload = function (e) {
            $scope.$apply(function () {
              $scope.signatureImage = e.target.result;
              toastr.success(gettextCatalog.getString('Signature image loaded successfully!'));
            });
          };
          reader.readAsDataURL(file);
        };

        $scope.removeSignatureImage = function () {
          $scope.signatureImage = null;
          var input = document.getElementById('sig-file-upload');
          if (input) {
            input.value = '';
          }
        };

        // Ouvre le choix de méthode de signature (en ligne / locale) puis lance le flux choisi
        $scope.proceedToSign = function (ev) {
          if ($scope.isSigning) return;

          $scope.isSigning = true;

          $mdDialog.show({
            templateUrl: 'views/sign/dialogs/signature.method.dialog.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$mdDialog', function ($dlgScope, $mdDialog) {
              $dlgScope.chooseMethod = function (method) {
                $mdDialog.hide(method);
              };
              $dlgScope.cancel = function () {
                $mdDialog.cancel();
              };
            }]
          }).then(function (chosenMethod) {
            if (chosenMethod === 'local') {
              localSign();
            } else {
              onlineSign();
            }
          }, function () {
            $scope.isSigning = false;
          });
        };

        // Flux de signature en ligne : vérifie la session TrustedX puis lance le processus
        function onlineSign() {
          $scope.isSigning = true;
          toastr.info(gettextCatalog.getString('Checking your digital identity session...'));

          SignatureProcessService.checkSession($scope.requestId)
            .then(function (res) {
              if (res.requireAuth && res.authUrl) {
                toastr.info(gettextCatalog.getString('Authentication required. Redirecting…'));
                try {
                  $window.sessionStorage.setItem('monarc_sig_autostart', String($scope.requestId));
                } catch (e) {}
                try {
                  $window.sessionStorage.setItem('monarc_sso_return_state', JSON.stringify({
                    state: 'main.project.anr.signatureProcess',
                    params: { modelId: $scope.modelId, requestId: $scope.requestId }
                  }));
                } catch (e) {}
                $window.location.href = res.authUrl;
              } else {
                startTrustedXProcess();
              }
            })
            .catch(function (err) {
              $scope.isSigning = false;
              toastr.error(gettextCatalog.getString('Unable to verify the session. Please try again.'));
            });
        }

        // Crée le processus de signature TrustedX pour l'étape courante et redirige vers son UI
        function startTrustedXProcess(silent) {
          $scope.isSigning = true;
          if (!silent) {
            toastr.info(gettextCatalog.getString('Creating the signature process…'));
          }
          SignatureProcessService.initiateSign($scope.requestId, $scope.signatureImage)
            .then(function (signResult) {
              if (signResult && signResult.requireAuth && signResult.authUrl) {
                try { $window.sessionStorage.setItem('monarc_sig_autostart', String($scope.requestId)); } catch (e) {}
                $window.location.href = signResult.authUrl;
                return;
              }
              if (signResult && signResult.redirectUrl) {
                $window.location.href = signResult.redirectUrl;
              } else {
                $scope.isSigning = false;
                toastr.error(gettextCatalog.getString('No signature URL provided by TrustedX.'));
              }
            })
            .catch(function (err) {
              $scope.isSigning = false;
              var msg = (err && err.data && err.data.error) ? err.data.error : gettextCatalog.getString('Unable to start the signature.');
              toastr.error(msg, gettextCatalog.getString('TrustedX failure'));
            });
        }

        // Si on revient d'une ré-autorisation TrustedX, relance directement la signature
        function maybeAutoResumeSign() {
          var flag = null;
          try { flag = $window.sessionStorage.getItem('monarc_sig_autostart'); } catch (e) {}
          if (!flag || String(flag) !== String($scope.requestId)) {
            return false;
          }
          try { $window.sessionStorage.removeItem('monarc_sig_autostart'); } catch (e) {}
          try { $window.sessionStorage.removeItem('monarc_sso_return_state'); } catch (e) {}

          if (!$scope.isMyTurn || $scope.isSigning || $scope.hasAlreadySigned) {
            return false;
          }
          startTrustedXProcess(true);
          return true;
        }

        // Flux de signature locale via le pilote USB BJ eToken
        function localSign() {
          $scope.isSigning = true;
          toastr.info(gettextCatalog.getString('Initializing the BJ eToken PKI driver...'));

          SignatureProcessService.downloadCurrentPdfBlob($scope.requestId)
            .then(function (pdfBlob) {
              var curSig = $scope.currentSignatory || {};
              var position = {
                page: curSig.page || 1,
                x: (curSig.coordX !== undefined && curSig.coordX !== null) ? curSig.coordX : curSig.x,
                y: (curSig.coordY !== undefined && curSig.coordY !== null) ? curSig.coordY : curSig.y,
                width: curSig.width,
                height: curSig.height
              };

              return BJeTokenService.signDocumentLocally(pdfBlob, position, $scope.signatureImage);
            })
            .then(function (result) {
              var certData = (result.certificate && (result.certificate.data || result.certificate)) || {};
              var certSubject = certData.subject || certData.cn || certData.alias || gettextCatalog.getString('BJ eToken certificate');

              return SignatureProcessService.uploadSignedPdf($scope.requestId, result.signedBlob, certSubject);
            })
            .then(function () {
              $scope.isSigning = false;
              toastr.success(gettextCatalog.getString('Document successfully signed locally with a hardware certificate!'));
              loadData();
            })
            .catch(function (err) {
              $scope.isSigning = false;
              var msg = (err && err.message) ? err.message : (typeof err === 'string' ? err : gettextCatalog.getString('Local signature error'));
              toastr.error(msg, gettextCatalog.getString('Local signature failure'));
            });
        }

        $scope.rejectDocument = function (ev) {
          $mdDialog.show({
            templateUrl: 'views/sign/dialogs/signature.reject.dialog.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$mdDialog', function ($dlgScope, $mdDialog) {
              $dlgScope.reason = '';
              $dlgScope.cancel = function () {
                $mdDialog.cancel();
              };
              $dlgScope.confirmReject = function () {
                if ($dlgScope.reason && $dlgScope.reason.trim()) {
                  $mdDialog.hide($dlgScope.reason.trim());
                }
              };
            }]
          }).then(function (reason) {
            $scope.isRejecting = true;
            SignatureProcessService.rejectSignature($scope.requestId, reason)
              .then(function () {
                $scope.isRejecting = false;
                toastr.warning(gettextCatalog.getString('The document has been rejected and the reason has been recorded.'));
                $state.go('main.project.anr.signatureList', { modelId: $scope.modelId });
              })
              .catch(function (err) {
                $scope.isRejecting = false;
                var msg = (err && err.data && err.data.error) ? err.data.error : gettextCatalog.getString('Error while rejecting');
                toastr.error(msg);
              });
          });
        };

        $scope.goToList = function () {
          $state.go('main.project.anr.signatureList', { modelId: $scope.modelId });
        };

        loadData();
      },
    ]);
})();