(function () {
  'use strict';

  angular
    .module('SignModule')
    .directive('signatureStatusChip', [
      'gettextCatalog',
      function (gettextCatalog) {
        return {
          restrict: 'E',
          scope: {
            status: '='
          },
          template: '<span class="sig-status-tag-compact sig-status-{{ currentStatus }}" ng-if="currentStatus">' +
                    '  <md-icon ng-if="currentIcon" class="sig-status-icon">{{ currentIcon }}</md-icon>' +
                    '  <span class="sig-status-text">{{ currentLabel }}</span>' +
                    '</span>',
          link: function (scope) {
            function update(st) {
              if (!st) {
                scope.currentStatus = null;
                scope.currentLabel = '';
                scope.currentIcon = null;
                return;
              }
              scope.currentStatus = st;
              var labels = {
                'pending_configuration': gettextCatalog.getString('To configure'),
                'pending': gettextCatalog.getString('Pending'),
                'partially_signed': gettextCatalog.getString('In progress'),
                'signed': gettextCatalog.getString('Signed'),
                'rejected': gettextCatalog.getString('Refused')
              };
              scope.currentLabel = labels[st] || st || gettextCatalog.getString('Unknown');

              switch (st) {
                case 'signed':
                  scope.currentIcon = 'check_circle';
                  break;
                case 'pending':
                case 'partially_signed':
                  scope.currentIcon = 'hourglass_empty';
                  break;
                case 'rejected':
                  scope.currentIcon = 'cancel';
                  break;
                default:
                  scope.currentIcon = null;
              }
            }

            scope.$watch('status', function (newVal) {
              update(newVal);
            });
          }
        };
      }
    ]);
})();
