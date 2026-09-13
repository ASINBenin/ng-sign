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
                'draft': gettextCatalog.getString('Draft'),
                'pending_configuration': gettextCatalog.getString('To configure'),
                'pending_config': gettextCatalog.getString('To configure'),
                'pending': gettextCatalog.getString('Pending'),
                'partially_signed': gettextCatalog.getString('In progress'),
                'in_progress': gettextCatalog.getString('In progress'),
                'signed': gettextCatalog.getString('Signed'),
                'finished': gettextCatalog.getString('Signed'),
                'completed': gettextCatalog.getString('Signed'),
                'rejected': gettextCatalog.getString('Refused'),
                'cancelled': gettextCatalog.getString('Cancelled'),
                'canceled': gettextCatalog.getString('Cancelled')
              };
              scope.currentLabel = labels[st] || st || gettextCatalog.getString('Unknown');

              switch (st) {
                case 'signed':
                case 'finished':
                case 'completed':
                  scope.currentIcon = 'check_circle';
                  break;
                case 'pending':
                case 'partially_signed':
                case 'in_progress':
                  scope.currentIcon = 'hourglass_empty';
                  break;
                case 'rejected':
                case 'cancelled':
                case 'canceled':
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
