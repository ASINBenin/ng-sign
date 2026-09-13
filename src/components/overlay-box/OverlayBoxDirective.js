(function () {
  'use strict';

  // Cadre déplaçable/redimensionnable représentant un signataire sur le PDF
  function overlayBoxDefinition(gettextCatalog) {
    return {
      restrict: 'E',
      scope: {
        signatory: '=?',
        box: '=?',
        scale: '=?',
        isActive: '=?',
        isSelected: '=?',
        onSelect: '&?',
        isDraggable: '=?'
      },
      template: '<div class="sig-box" ' +
                '     ng-class="{\'sig-box-active\': (isActive || isSelected)}" ' +
                '     ng-style="{' +
                '       \'top\': getTop(), ' +
                '       \'left\': getLeft(), ' +
                '       \'width\': getWidth(), ' +
                '       \'height\': getHeight(), ' +
                '       \'border-color\': item.color || \'#006fba\', ' +
                '       \'background-color\': item.bgColor || \'rgba(0, 111, 186, 0.08)\'' +
                '     }" ' +
                '     ng-click="handleClick($event)">' +
                '  <div class="sig-box-body">' +
                '    <div layout="column" layout-align="center center">' +
                '      <div style="font-weight: 700; font-size: 12px; color: {{ item.color || \'#006fba\' }};">#{{ item.order || 1 }} - {{ getUserName() }}</div>' +
                '      <div class="sig-box-label" style="margin-top: 2px; color: #475569; font-size: 11px; font-weight: 500;">{{ getUserEmail() }}</div>' +
                '    </div>' +
                '  </div>' +
                '  <div class="sig-resize-handle" ng-mousedown="startResize($event)" ng-style="{\'background-color\': item.color || \'#006fba\'}"></div>' +
                '</div>',
      link: function (scope, element) {
        scope.item = scope.signatory || scope.box || {};

        scope.getScale = function () {
          return scope.scale || 1.0;
        };

        scope.getLeft = function () {
          var x = (scope.item && scope.item.x !== undefined && scope.item.x !== null) ? scope.item.x : 100;
          return (x * scope.getScale()) + 'px';
        };

        scope.getTop = function () {
          var y = (scope.item && scope.item.y !== undefined && scope.item.y !== null) ? scope.item.y : 100;
          return (y * scope.getScale()) + 'px';
        };

        scope.getWidth = function () {
          var w = (scope.item && scope.item.width !== undefined && scope.item.width !== null) ? scope.item.width : 180;
          return (w * scope.getScale()) + 'px';
        };

        scope.getHeight = function () {
          var h = (scope.item && scope.item.height !== undefined && scope.item.height !== null) ? scope.item.height : 60;
          return (h * scope.getScale()) + 'px';
        };

        scope.$watch('signatory', function (newVal) {
          if (newVal) scope.item = newVal;
        });

        scope.getUserName = function () {
          var sig = scope.item;
          if (sig && sig.user) {
            var name = ((sig.user.firstname || '') + ' ' + (sig.user.lastname || '')).trim();
            return name || sig.user.email || (gettextCatalog.getString('Signatory #') + (sig.order || 1));
          }
          return gettextCatalog.getString('New signatory');
        };

        scope.getUserEmail = function () {
          var sig = scope.item;
          if (sig && sig.user && sig.user.email) {
            return sig.user.email;
          }
          return gettextCatalog.getString('Drag to move');
        };

        scope.handleClick = function (ev) {
          if (scope.onSelect) {
            scope.onSelect({ sig: scope.item });
          }
        };

        var boxEl = element[0].querySelector('.sig-box');
        if (!boxEl) return;

        var isDragging = false;
        var isResizing = false;
        var startX = 0, startY = 0, initialX = 0, initialY = 0, initialW = 0, initialH = 0;

        boxEl.addEventListener('mousedown', function (e) {
          if (e.target.classList.contains('sig-resize-handle')) return;
          isDragging = true;
          boxEl.classList.add('sig-box-dragging');
          startX = e.clientX;
          startY = e.clientY;
          initialX = (scope.item.x !== undefined && scope.item.x !== null) ? scope.item.x : 100;
          initialY = (scope.item.y !== undefined && scope.item.y !== null) ? scope.item.y : 100;
          if (scope.onSelect) {
            scope.$apply(function () {
              scope.onSelect({ sig: scope.item });
            });
          }
          e.preventDefault();
        });

        scope.startResize = function (e) {
          isResizing = true;
          startX = e.clientX;
          startY = e.clientY;
          initialW = (scope.item.width !== undefined && scope.item.width !== null) ? scope.item.width : 180;
          initialH = (scope.item.height !== undefined && scope.item.height !== null) ? scope.item.height : 60;
          e.stopPropagation();
          e.preventDefault();
        };

        document.addEventListener('mousemove', function (e) {
          if (!isDragging && !isResizing) return;

          var overlay = element[0].closest('.pdf-overlay') || element[0].parentElement;
          var currentScale = scope.getScale();

          var overlayW = (overlay && overlay.clientWidth) ? overlay.clientWidth : (595 * currentScale);
          var overlayH = (overlay && overlay.clientHeight) ? overlay.clientHeight : (842 * currentScale);
          var pageWidth = overlayW / currentScale;
          var pageHeight = overlayH / currentScale;

          var dx = (e.clientX - startX) / currentScale;
          var dy = (e.clientY - startY) / currentScale;

          scope.$apply(function () {
            if (isDragging) {
              var w = (scope.item.width !== undefined && scope.item.width !== null) ? scope.item.width : 180;
              var h = (scope.item.height !== undefined && scope.item.height !== null) ? scope.item.height : 60;

              var maxX = Math.max(0, pageWidth - w);
              var maxY = Math.max(0, pageHeight - h);

              var newX = initialX + dx;
              var newY = initialY + dy;

              scope.item.x = Math.round(Math.min(Math.max(0, newX), maxX));
              scope.item.y = Math.round(Math.min(Math.max(0, newY), maxY));
              scope.item._dirty = true;

            } else if (isResizing) {
              var curX = (scope.item.x !== undefined && scope.item.x !== null) ? scope.item.x : 100;
              var curY = (scope.item.y !== undefined && scope.item.y !== null) ? scope.item.y : 100;

              var maxAllowedW = Math.max(60, pageWidth - curX);
              var maxAllowedH = Math.max(30, pageHeight - curY);

              var newW = initialW + dx;
              var newH = initialH + dy;

              scope.item.width = Math.round(Math.min(Math.max(100, newW), maxAllowedW));
              scope.item.height = Math.round(Math.min(Math.max(36, newH), maxAllowedH));
              scope.item._dirty = true;
            }
          });
        });

        document.addEventListener('mouseup', function () {
          if (isDragging) {
            isDragging = false;
            boxEl.classList.remove('sig-box-dragging');
          }
          if (isResizing) {
            isResizing = false;
          }
        });
      }
    };
  }

  angular.module('SignModule').directive('overlayBox', ['gettextCatalog', overlayBoxDefinition]);
})();