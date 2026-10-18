(function () {
  'use strict';

  angular
    .module('SignModule')
    .controller('SignatureListCtrl', [
      '$scope',
      '$rootScope',
      '$state',
      '$stateParams',
      '$window',
      '$mdDialog',
      'SignatureRequestService',
      'SignatureProcessService',
      'UserProfileService',
      'ClientAnrService',
      'toastr',
      'gettextCatalog',
      function ($scope, $rootScope, $state, $stateParams, $window, $mdDialog, SignatureRequestService, SignatureProcessService, UserProfileService, ClientAnrService, toastr, gettextCatalog) {
        $scope.modelId = parseInt($stateParams.modelId || $rootScope.getUrlAnrId(), 10);
        $scope.model = $scope.model || ($scope.$parent && $scope.$parent.model ? $scope.$parent.model : {});
        $scope.isLoading = true;
        $scope.requests = [];
        $scope.connectedUser = null;
        $scope.statusFilter = 'all';
        $scope.searchFilter = '';

        $scope.filterRequests = function (req) {
          if (!req) return false;
          if ($scope.statusFilter && $scope.statusFilter !== 'all') {
            if ($scope.statusFilter === 'pending_configuration' && req.status !== 'pending_configuration') return false;
            if ($scope.statusFilter === 'pending' && req.status !== 'pending' && req.status !== 'partially_signed') return false;
            if ($scope.statusFilter === 'signed' && req.status !== 'signed') return false;
            if ($scope.statusFilter === 'rejected' && req.status !== 'rejected') return false;
          }
          if ($scope.searchFilter) {
            var query = $scope.searchFilter.toLowerCase().trim();
            var title = (req.title || '').toLowerCase();
            var idStr = '#' + req.id + ' ' + req.id;
            var dateStr = (req.createdAt || '').toLowerCase();
            var signersStr = (req.signatories || []).map(function (s) { return (s.userName || '') + ' ' + (s.userEmail || ''); }).join(' ').toLowerCase();
            return title.indexOf(query) !== -1 || idStr.indexOf(query) !== -1 || dateStr.indexOf(query) !== -1 || signersStr.indexOf(query) !== -1;
          }
          return true;
        };

        $scope.resetFilter = function () {
          $scope.statusFilter = 'all';
          $scope.searchFilter = '';
          $scope.loadData();
        };

        function syncAnrModel() {
          if ($scope.clientAnrs && $scope.clientAnrs.length) {
            var matched = $scope.clientAnrs.find(function (a) { return a.id == $scope.modelId; });
            if (matched) {
              $scope.model.anr = matched;
              if ($scope.$parent && $scope.$parent.model) {
                $scope.$parent.model.anr = matched;
              }
            }
          }
          if ((!$scope.model.anr || !$scope.model.anr.label) && ClientAnrService) {
            ClientAnrService.getAnr($scope.modelId).then(function (anrData) {
              $scope.model.anr = anrData;
              if ($scope.$parent && $scope.$parent.model) {
                $scope.$parent.model.anr = anrData;
              }
            }, function () {
              $scope.model.anr = { id: $scope.modelId, label: gettextCatalog.getString('Risk analysis #') + $scope.modelId };
            });
          }
        }

        $scope.$watch(function () {
          return ($scope.$parent && $scope.$parent.model && $scope.$parent.model.anr && $scope.$parent.model.anr.id) ||
                 ($scope.model && $scope.model.anr && $scope.model.anr.id);
        }, function (newId) {
          if (newId && newId !== $scope.modelId) {
            $scope.modelId = parseInt(newId, 10);
            syncAnrModel();
            $scope.loadData();
          }
        });

        function init() {
          syncAnrModel();
          if (UserProfileService && UserProfileService.getProfile) {
            UserProfileService.getProfile().then(function (profile) {
              $scope.connectedUser = (profile && profile.user) ? profile.user : profile;
              $scope.loadData();
            }, function () {
              $scope.loadData();
            });
          } else {
            $scope.loadData();
          }
        }

        $scope.loadData = function () {
          $scope.isLoading = true;
          var targetModelId = $scope.modelId || $rootScope.getUrlAnrId();
          SignatureRequestService.getSignatureRequests(targetModelId)
            .then(function (res) {
              $scope.isLoading = false;
              $scope.requests = res.requests || [];
            })
            .catch(function (err) {
              $scope.isLoading = false;
              // Les erreurs HTTP sont déjà affichées par l'intercepteur de ng-client
              if (!err || !err.status) {
                toastr.error(gettextCatalog.getString('Error loading signature requests'));
              }
            });
        };

        $scope.downloadPdf = function (req) {
          SignatureProcessService.downloadPdf(req.id);
        };

        $scope.viewProcess = function (req) {
          $state.go('main.project.anr.signatureProcess', { modelId: $scope.modelId, requestId: req.id });
        };

        $scope.isMyTurn = function (req) {
          if (!req || (req.status !== 'pending' && req.status !== 'partially_signed')) {
            return false;
          }
          if (!$scope.connectedUser || !req.signatories || !req.signatories.length) {
            return false;
          }

          var currentStep = req.currentStep || 1;
          var curSig = req.signatories.find(function (s) {
            return s.order === currentStep;
          });

          if (curSig && curSig.userId && curSig.userId == $scope.connectedUser.id && curSig.status === 'pending') {
            return true;
          }
          return false;
        };

        $scope.getSignedCount = function (req) {
          if (!req || !req.signatories) return 0;
          return req.signatories.filter(function (s) { return s.status === 'signed'; }).length;
        };

        $scope.openStepperDialog = function (req, ev) {
          $mdDialog.show({
            templateUrl: 'views/sign/dialogs/signature.stepper.dialog.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$mdDialog', function ($dlgScope, $mdDialog) {
              $dlgScope.req = req;
              $dlgScope.getSignedCount = function () {
                if (!req || !req.signatories) return 0;
                return req.signatories.filter(function (s) { return s.status === 'signed'; }).length;
              };
              $dlgScope.close = function () {
                $mdDialog.hide();
              };
            }]
          });
        };

        $scope.goToSetup = function (req) {
          $state.go('main.project.anr.signatureSetup', { modelId: $scope.modelId, requestId: req.id });
        };

        $scope.deleteRequest = function (req, ev) {
          var confirm = $mdDialog.confirm()
            .title(gettextCatalog.getString('Delete this signature process?'))
            .textContent(gettextCatalog.getString('Are you sure you want to delete this pending signature request? This action is irreversible.'))
            .ariaLabel(gettextCatalog.getString('Deleting the process'))
            .targetEvent(ev)
            .ok(gettextCatalog.getString('Yes, delete'))
            .cancel(gettextCatalog.getString('Cancel'));

          $mdDialog.show(confirm).then(function () {
            SignatureRequestService.deleteSignatureRequest($scope.modelId, req.id)
              .then(function () {
                toastr.success(gettextCatalog.getString('Signature process deleted.'));
                $scope.loadData();
              })
              .catch(function (err) {
                if (!err || !err.status) {
                  toastr.error(gettextCatalog.getString('Error while deleting'));
                }
              });
          });
        };

        init();
      },
    ]);
})();
