{{/*
Expand the name of the chart.
*/}}
{{- define "credit-undertaker.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "credit-undertaker.fullname" -}}
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
{{- define "credit-undertaker.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "credit-undertaker.labels" -}}
helm.sh/chart: {{ include "credit-undertaker.chart" . }}
{{ include "credit-undertaker.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "credit-undertaker.selectorLabels" -}}
app.kubernetes.io/name: {{ include "credit-undertaker.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "credit-undertaker.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "credit-undertaker.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate the env+service prefix for secret names, e.g. dev_credit-undertaker_
*/}}
{{- define "credit-undertaker.envServicePrefix" -}}
{{- if .Values.envServicePrefix }}
{{- .Values.envServicePrefix -}}
{{- else -}}
{{- printf "%s_%s_" .Values.lettaEnv .Chart.Name -}}
{{- end }}
{{- end }}

{{/*
Generate the k8s safe (RFC1035 compliant) env+service prefix for secret names, i.e. no underscores and lowercase
*/}}
{{- define "credit-undertaker.k8sEnvServicePrefix" -}}
{{- if .Values.envServicePrefix }}
{{- .Values.envServicePrefix | replace "_" "-" | lower -}}
{{- else -}}
{{- printf "%s_%s_" .Values.lettaEnv .Chart.Name | replace "_" "-" | lower -}}
{{- end }}
{{- end }}
