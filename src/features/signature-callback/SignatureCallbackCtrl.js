(function () {
  'use strict';

  angular
    .module('SignModule')
    .controller('SignatureCallbackCtrl', [
      '$scope',
      '$rootScope',
      '$state',
      '$stateParams',
      '$window',
      '$location',
      '$q',
      'SignatureRequestService',
      'SignatureProcessService',
      'ClientAnrService',
      'UserService',
      'UserProfileService',
      'toastr',
      'gettextCatalog',
      function ($scope, $rootScope, $state, $stateParams, $window, $location, $q, SignatureRequestService, SignatureProcessService, ClientAnrService, UserService, UserProfileService, toastr, gettextCatalog) {
        $scope.modelId = parseInt($stateParams.modelId || $rootScope.getUrlAnrId(), 10);
        $scope.requestId = $stateParams.requestId ? parseInt($stateParams.requestId, 10) : null;
        $scope.model = $scope.model || {};

        if ($scope.modelId && ClientAnrService) {
          ClientAnrService.getAnr($scope.modelId).then(function (anrData) {
            $rootScope.model = $rootScope.model || {};
            $rootScope.model.anr = anrData;
          }).catch(function () {
            $rootScope.model = $rootScope.model || {};
            $rootScope.model.anr = { id: $scope.modelId, label: 'Analyse #' + $scope.modelId };
          });
        }
        $scope.connectedUser = null;
        
        $scope.isLoading = true;
        $scope.isFinished = false;
        $scope.isSuccess = false;
        $scope.isError = false;
        $scope.statusTitle = gettextCatalog.getString('Initializing...');
        $scope.statusMessage = gettextCatalog.getString('Please wait...');

        function cleanUrlParams() {
          if ($window.history && $window.history.replaceState) {
            var cleanUrl = $location.absUrl().split('?')[0];
            $window.history.replaceState(null, '', cleanUrl);
          }
        }

        function init() {
          var userPromise = (UserProfileService && UserProfileService.getProfile)
            ? UserProfileService.getProfile()
            : Promise.resolve(null);

          userPromise.then(function (user) {
            $scope.connectedUser = user;
            processCallback();
          }).catch(function () {
            processCallback();
          });
        }

        // Interprète les paramètres de retour TrustedX et redirige selon le cas
        function processCallback() {
          var searchParams = $location.search() || {};
          var signatureSuccess = $stateParams.signatureSuccess || searchParams.signatureSuccess;
          var signatureError   = $stateParams.signatureError   || searchParams.signatureError;
          var status           = $stateParams.status           || searchParams.status;

          if (signatureError) {
            $scope.isLoading = false;
            $scope.isError = true;
            $scope.statusTitle = gettextCatalog.getString('Signature error');
            $scope.statusMessage = decodeURIComponent(signatureError.replace(/\+/g, ' '));
            toastr.error($scope.statusMessage);
            cleanUrlParams();
            return;
          }

          if (status === 'cancel' || status === 'canceled' || status === 'rejected' || status === 'failed' || status === 'error') {
            $scope.isLoading = false;
            $scope.isError = true;
            $scope.statusTitle = gettextCatalog.getString('Signature cancelled or rejected');
            $scope.statusMessage = gettextCatalog.getString('The signature process has been interrupted.');
            toastr.warning($scope.statusMessage);
            cleanUrlParams();
            return;
          }

          var txCompleted = $window.sessionStorage.getItem('tx_signing_completed') === 'true';
          if (txCompleted || signatureSuccess === '1' || signatureSuccess === 'true') {
            $window.sessionStorage.removeItem('tx_signing_completed');
            toastr.success(gettextCatalog.getString('Your signature has been saved successfully.'));
            cleanUrlParams();
            $state.go('main.project.anr.signatureProcess', {
              modelId: $scope.modelId,
              requestId: $scope.requestId
            });
            return;
          }

          if (status === 'finished') {
            $window.sessionStorage.setItem('tx_signing_completed', 'true');
            $scope.statusTitle = gettextCatalog.getString('Signature confirmed, preloading the document...');
            $scope.statusMessage = gettextCatalog.getString('Please wait, finalizing...');

            SignatureProcessService.getReauthUrl($scope.requestId)
              .then(function (res) {
                if (res && res.url) {
                  $window.location.href = res.url;
                } else {
                  $window.sessionStorage.removeItem('tx_signing_completed');
                  $state.go('main.project.anr.signatureProcess', {
                    modelId: $scope.modelId,
                    requestId: $scope.requestId
                  });
                }
              })
              .catch(function (err) {
                console.error('[SignatureCallbackCtrl] getReauthUrl erreur:', err);
                $window.sessionStorage.removeItem('tx_signing_completed');
                $state.go('main.project.anr.signatureProcess', {
                  modelId: $scope.modelId,
                  requestId: $scope.requestId
                });
              });
            return;
          }

          $state.go('main.project.anr.signatureProcess', {
            modelId: $scope.modelId,
            requestId: $scope.requestId
          });
        }

        $scope.downloadSignedDocument = function () {
          var downloadUrl = SignatureProcessService.getPdfUrl($scope.requestId);
          $window.open(downloadUrl, '_blank');
        };

        $scope.goToSignatureList = function () {
          if ($scope.modelId) {
            $state.go('main.project.anr.signatureList', { modelId: $scope.modelId });
          } else {
            $state.go('main.project');
          }
        };

        init();
      }
    ]);
})();
