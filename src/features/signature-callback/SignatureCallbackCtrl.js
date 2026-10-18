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
      'toastr',
      'gettextCatalog',
      'SignatureProcessService',
      'ClientAnrService',
      'UserProfileService',
      function ($scope, $rootScope, $state, $stateParams, $window, $location, toastr, gettextCatalog, SignatureProcessService, ClientAnrService, UserProfileService) {
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

          if (signatureSuccess === '1' || signatureSuccess === 'true') {
            toastr.success(gettextCatalog.getString('Your signature has been saved successfully.'));
            cleanUrlParams();
            goToSignatureProcess();
            return;
          }

          if (status === 'finished') {
            $scope.statusTitle = gettextCatalog.getString('Signature confirmed, preloading the document...');
            $scope.statusMessage = gettextCatalog.getString('Please wait, finalizing...');
            finalizeOrReauthorize();
            return;
          }

          goToSignatureProcess();
        }

        // Finalise avec le jeton TrustedX stocké ; sinon ré-autorisation OAuth2 (retour sur /callback avec code)
        function finalizeOrReauthorize() {
          SignatureProcessService.finalizeSignature($scope.requestId)
            .then(function (res) {
              if (res.finalized) {
                toastr.success(gettextCatalog.getString('Your signature has been saved successfully.'));
                cleanUrlParams();
                goToSignatureProcess();
                return;
              }
              return SignatureProcessService.getReauthUrl($scope.requestId).then(function (reauth) {
                $window.location.href = reauth.url;
              });
            })
            .catch(function () {
              goToSignatureProcess();
            });
        }

        function goToSignatureProcess() {
          $state.go('main.project.anr.signatureProcess', {
            modelId: $scope.modelId,
            requestId: $scope.requestId
          });
        }

        $scope.downloadSignedDocument = function () {
          SignatureProcessService.downloadPdf($scope.requestId);
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
