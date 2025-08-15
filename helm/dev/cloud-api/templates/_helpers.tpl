{{/*
Expand the name of the chart.
*/}}
{{- define "cloud-api.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "cloud-api.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "cloud-api.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "cloud-api.labels" -}}
helm.sh/chart: {{ include "cloud-api.chart" . }}
{{ include "cloud-api.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "cloud-api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "cloud-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "cloud-api.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "cloud-api.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate the env+service prefix for secret names, e.g. dev_cloud-api_
*/}}
{{- define "cloud-api.envServicePrefix" -}}
{{- if .Values.envServicePrefix }}
{{- .Values.envServicePrefix -}}
{{- else -}}
{{- printf "%s_%s_" .Values.lettaEnv .Chart.Name -}}
{{- end }}
{{- end }}

{{/*
Generate the k8s safe (RFC1035 compliant) env+service prefix for secret names, i.e. no underscores and lowercase
*/}}
{{- define "cloud-api.k8sEnvServicePrefix" -}}
{{- if .Values.envServicePrefix }}
{{- .Values.envServicePrefix | replace "_" "-" | lower -}}
{{- else -}}
{{- printf "%s_%s_" .Values.lettaEnv .Chart.Name | replace "_" "-" | lower -}}
{{- end }}
{{- end }}
