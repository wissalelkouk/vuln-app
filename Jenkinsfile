pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 60, unit: 'MINUTES')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh 'mkdir -p reports'
      }
    }

    stage('Build') {
      steps {
        sh 'docker run --rm -v "$PWD:/app" -w /app node:24-alpine sh -c "npm ci"'
      }
    }

    stage('Security') {
      parallel {
        stage('Gitleaks') {
          steps {
            sh '''
              docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:latest \
                git /repo --redact --report-format json --report-path /repo/reports/gitleaks.json
            '''
          }
        }
        stage('Semgrep') {
          steps {
            sh '''
              docker run --rm -v "$PWD:/src" semgrep/semgrep \
                semgrep scan --config p/javascript --config p/owasp-top-ten --config .semgrep/no-log-body.yml \
                --metrics=off --error --json --output /src/reports/semgrep.json /src
            '''
          }
        }
        stage('npm audit') {
          steps {
            sh '''
              docker run --rm -v "$PWD:/app" -w /app node:24-alpine \
                sh -c "npm audit --audit-level=high --json > reports/npm-audit.json; \
                       code=\\$?; npm audit --audit-level=high; exit \\$code"
            '''
          }
        }
      }
    }

    stage('Image scan') {
      steps {
        sh '''
          docker build -t vuln-app:${BUILD_NUMBER} .
          docker run --rm -v trivy-cache:/root/.cache/ \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -v "$PWD/reports:/reports" aquasec/trivy:latest image \
            --skip-db-update --skip-java-db-update --skip-version-check --scanners vuln --no-progress \
            --severity CRITICAL --exit-code 1 --ignore-unfixed \
            --format json --output /reports/trivy-image.json vuln-app:${BUILD_NUMBER}
        '''
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
    }
  }
}
