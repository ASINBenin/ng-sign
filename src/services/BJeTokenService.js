(function () {
  'use strict';

  angular
    .module('SignModule')
    .service('BJeTokenService', [
      '$q',
      'SignConfig',
      'gettextCatalog',
      function ($q, SignConfig, gettextCatalog) {
        var BASE_URL = (SignConfig && SignConfig.bjeTokenDriverUrl) ? SignConfig.bjeTokenDriverUrl : 'https://127.0.0.1:42304';

        // Vérifie que le driver BJ eToken local est accessible
        this.checkDriver = function () {
          var deferred = $q.defer();

          window.fetch(BASE_URL + '/info', {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
          })
          .then(function (res) {
            if (!res.ok) {
              return window.fetch(BASE_URL + '/', { method: 'GET', mode: 'cors' });
            }
            return res;
          })
          .then(function (res) { return res.json(); })
          .then(function (data) { deferred.resolve(data); })
          .catch(function (err) {
            deferred.reject(new Error(gettextCatalog.getString('The BJ eToken Driver software is not reachable. Make sure it is running on your computer (https://127.0.0.1:42304).')));
          });

          return deferred.promise;
        };

        // Récupère tous les certificats disponibles
        this.getCertificates = function (level) {
          var deferred = $q.defer();
          var url = BASE_URL + '/api/keys' + (level ? ('?level=' + encodeURIComponent(level)) : '');

          window.fetch(url, {
            method: 'GET',
            mode: 'cors'
          })
          .then(function (res) { return res.json(); })
          .then(function (data) { deferred.resolve(data); })
          .catch(function (err) { deferred.reject(err); });

          return deferred.promise;
        };

        // Récupère le premier certificat PKI valide pour signer
        this.getFirstPkiCertificate = function (level) {
          var deferred = $q.defer();
          var url = BASE_URL + '/api/keys/first-pki-certificate' + (level ? ('?level=' + encodeURIComponent(level)) : '');

          window.fetch(url, {
            method: 'GET',
            mode: 'cors'
          })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(function (data) {
            deferred.resolve(data);
          })
          .catch(function () {
            window.fetch(BASE_URL + '/api/keys', { method: 'GET', mode: 'cors' })
              .then(function (res) { return res.json(); })
              .then(function (keys) {
                var list = Array.isArray(keys) ? keys : (keys.keys || keys.data || []);
                if (list && list.length) {
                  deferred.resolve(list[0]);
                } else {
                  deferred.reject(new Error(gettextCatalog.getString('No certificate found on your USB key. Please plug in your cryptographic key.')));
                }
              })
              .catch(function () {
                deferred.reject(new Error(gettextCatalog.getString('No certificate found on your USB key. Please plug in your cryptographic key.')));
              });
          });

          return deferred.promise;
        };

        // Prépare le fichier à signer côté driver (process-file)
        this.processFile = function (certificateAlias, position, pdfBlob, imageBase64, buildDir, fileName) {
          var deferred = $q.defer();

          if (!certificateAlias) {
            deferred.reject(new Error(gettextCatalog.getString("The certificate alias is required.")));
            return deferred.promise;
          }
          if (!pdfBlob) {
            deferred.reject(new Error(gettextCatalog.getString("The PDF file to sign is required.")));
            return deferred.promise;
          }
          if (!position) {
            deferred.reject(new Error(gettextCatalog.getString("The signature positioning coordinates are required.")));
            return deferred.promise;
          }

          if (position.x === undefined || position.x === null || isNaN(Number(position.x))) {
            deferred.reject(new Error(gettextCatalog.getString("The signature X coordinate could not be found.")));
            return deferred.promise;
          }
          if (position.y === undefined || position.y === null || isNaN(Number(position.y))) {
            deferred.reject(new Error(gettextCatalog.getString("The signature Y coordinate could not be found.")));
            return deferred.promise;
          }
          if (!position.width || isNaN(Number(position.width))) {
            deferred.reject(new Error(gettextCatalog.getString("The signature width could not be found.")));
            return deferred.promise;
          }
          if (!position.height || isNaN(Number(position.height))) {
            deferred.reject(new Error(gettextCatalog.getString("The signature height could not be found.")));
            return deferred.promise;
          }

          var formData = new FormData();
          formData.append('certificateAlias', certificateAlias);
          formData.append('buildDir', buildDir || ('signature-' + Date.now()));

          var hasImage = Boolean(imageBase64);
          formData.append('type', hasImage ? 'IMAGE_TEXT' : 'ALIAS_NAME');

          if (hasImage) {
            formData.append('image', imageBase64);
          }

          var actualFileName = fileName || (buildDir ? (buildDir.replace('signature-', '') + '.pdf') : 'document.pdf');
          var fileToUpload = new File([pdfBlob], actualFileName, { type: 'application/pdf' });
          formData.append('file', fileToUpload);

          var rawX = Math.max(10, Math.round(Number(position.x)));
          var rawY = Math.max(10, Math.round(Number(position.y)));
          var width = Math.round(Number(position.width));
          var height = Math.round(Number(position.height));
          var page = parseInt(position.page || 1, 10);

          formData.append('position.x', rawX);
          formData.append('position.y', rawY);
          formData.append('position.width', width);
          formData.append('position.height', height);
          formData.append('position.page', page);

          window.fetch(BASE_URL + '/api/sign/process-file', {
            method: 'POST',
            mode: 'cors',
            body: formData
          })
          .then(function (res) { return res.json(); })
          .then(function (data) { deferred.resolve(data); })
          .catch(function (err) { deferred.reject(err); });

          return deferred.promise;
        };

        // Exécute la signature (saisie du PIN gérée par le driver)
        this.executeSign = function (certificateAlias, buildDir, processIds) {
          var deferred = $q.defer();
          var payload = {
            certificateAlias: certificateAlias || '',
            buildDir: buildDir,
            processIds: Array.isArray(processIds) ? processIds : [processIds]
          };

          window.fetch(BASE_URL + '/api/sign/process-file/execute', {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          .then(function (res) { return res.json(); })
          .then(function (data) { deferred.resolve(data); })
          .catch(function (err) { deferred.reject(err); });

          return deferred.promise;
        };

        // Télécharge le document signé depuis le driver
        this.downloadSignedFile = function (filePath) {
          var deferred = $q.defer();
          if (!filePath) {
            deferred.reject(new Error(gettextCatalog.getString('Missing signed file path')));
            return deferred.promise;
          }

          var cleanPath = String(filePath).replace(/^\/+/, '');
          var url = filePath.indexOf('http') === 0 ? filePath : (BASE_URL + '/' + cleanPath);

          window.fetch(url, {
            method: 'GET',
            mode: 'cors'
          })
          .then(function (res) {
            if (!res.ok) {
              throw new Error(gettextCatalog.getString('HTTP error') + " " + res.status + " " + gettextCatalog.getString('while retrieving the signed PDF from the driver (') + url + ').');
            }
            return res.blob();
          })
          .then(function (blob) {
            deferred.resolve(blob);
          })
          .catch(function (err) {
            console.error('[BJeTokenService] downloadSignedFile error:', err);
            deferred.reject(err);
          });

          return deferred.promise;
        };

        // Orchestration complète du flux local de signature
        this.signDocumentLocally = function (pdfBlob, position, signatureImage) {
          var self = this;
          var timestamp = Date.now();
          var buildDir = 'signature-' + timestamp;
          var fileName = timestamp + '.pdf';
          var chosenCert = null;

          return self.checkDriver()
            .then(function () {
              return self.getFirstPkiCertificate();
            })
            .then(function (cert) {
              chosenCert = cert;
              var alias = cert.alias || (cert.certificate ? cert.certificate.alias : cert.cn) || '';
              return self.processFile(alias, position, pdfBlob, signatureImage, buildDir, fileName);
            })
            .then(function (procRes) {
              if (!procRes || !procRes.success) {
                var msg = (procRes && procRes.message) ? procRes.message : gettextCatalog.getString('Failed to prepare the file in BJ eToken Driver.');
                return $q.reject(new Error(msg));
              }
              var processId = procRes.message || (procRes.data ? (procRes.data.processId || procRes.data.id) : null) || procRes.processId || procRes.id;
              var alias = (chosenCert.data && chosenCert.data.alias) || chosenCert.alias || (chosenCert.certificate ? chosenCert.certificate.alias : chosenCert.cn) || '';
              return self.executeSign(alias, buildDir, [processId]);
            })
            .then(function (execRes) {
              var result = Array.isArray(execRes) ? execRes[0] : execRes;
              if (!result || !result.success) {
                var msg = (result && result.message) ? result.message : gettextCatalog.getString('Signature cancelled or rejected in BJ eToken Driver.');
                return $q.reject(new Error(msg));
              }
              var signedPath = result.message || result.signedFile || result.filePath || ('/medias/' + buildDir + '/' + fileName);
              return self.downloadSignedFile(signedPath);
            })
            .then(function (signedBlob) {
              self.deleteBuildDir(buildDir);

              return {
                signedBlob: signedBlob,
                certificate: chosenCert
              };
            });
        };

        this.deleteBuildDir = function (buildDir) {
          var deferred = $q.defer();
          if (!buildDir) {
            deferred.resolve();
            return deferred.promise;
          }

          var url = BASE_URL + '/api/sign/dir/' + encodeURIComponent(buildDir);

          window.fetch(url, {
            method: 'DELETE',
            mode: 'cors'
          })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            deferred.resolve(data);
          })
          .catch(function (err) {
            deferred.resolve();
          });

          return deferred.promise;
        };
      },
    ]);
})();
