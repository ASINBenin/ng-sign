(function () {
  'use strict';

  angular
    .module('SignModule')
    .service('SignatureProcessService', [
      '$http',
      '$q',
      function ($http, $q) {
        this.getSignatureRequest = function (modelId, requestId) {
          if (!modelId || !requestId) {
            return $q.reject(new Error("modelId et requestId sont obligatoires"));
          }
          return $http.get('api/anrs/' + modelId + '/signature-requests/' + requestId)
            .then(function (res) { return res.data; });
        };

        this.initiateSign = function (requestId, signatureImage) {
          if (!requestId) {
            return $q.reject(new Error("requestId est obligatoire"));
          }
          return $http.post('api/signature-requests/' + requestId + '/sign', {
            signatureImage: signatureImage || null
          }).then(function (res) { return res.data; });
        };

        this.rejectSignature = function (requestId, reason) {
          if (!requestId) {
            return $q.reject(new Error("requestId est obligatoire"));
          }
          return $http.post('api/signature-requests/' + requestId + '/reject', { reason: reason })
            .then(function (res) { return res.data; });
        };

        this.checkTokenValidity = function (requestId) {
          if (!requestId) {
            return $q.reject(new Error("requestId est obligatoire"));
          }
          return $http.get('api/signature-requests/' + requestId + '/check-token')
            .then(function (res) { return res.data; });
        };

        this.checkSession = function (requestId) {
          return this.checkTokenValidity(requestId);
        };

        this.getPdfUrl = function (requestId) {
          if (!requestId) {
            return '';
          }
          return 'api/signature-requests/' + requestId + '/pdf?t=' + Date.now();
        };

        this.downloadCurrentPdfBlob = function (requestId) {
          if (!requestId) {
            return $q.reject(new Error("requestId est obligatoire"));
          }
          return $http.get('api/signature-requests/' + requestId + '/pdf', { responseType: 'blob' })
            .then(function (res) { return res.data; });
        };

        this.getReauthUrl = function (requestId) {
          if (!requestId) {
            return $q.reject(new Error("requestId est obligatoire"));
          }
          return $http.get('api/signature-requests/' + requestId + '/reauth-url')
            .then(function (res) { return res.data; });
        };

        this.uploadSignedPdf = function (requestId, pdfBlob, certSubject) {
          if (!requestId || !pdfBlob) {
            return $q.reject(new Error("requestId et pdfBlob sont obligatoires"));
          }
          var formData = new FormData();
          var file = pdfBlob instanceof File ? pdfBlob : new File([pdfBlob], 'signed_document.pdf', { type: 'application/pdf' });
          formData.append('file', file);
          if (certSubject) {
            formData.append('certificateSubject', certSubject);
          }

          return $http.post('api/signature-requests/' + requestId + '/upload-signed', formData, {
            transformRequest: angular.identity,
            headers: { 'Content-Type': undefined }
          }).then(function (res) {
            return res.data;
          });
        };
      },
    ]);
})();