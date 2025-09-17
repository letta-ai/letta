{{/*
Expand the name of the chart.
*/}}
{{- define "lettuce-py.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "lettuce-py.fullname" -}}
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
{{- define "lettuce-py.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "lettuce-py.labels" -}}
helm.sh/chart: {{ include "lettuce-py.chart" . }}
{{ include "lettuce-py.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "lettuce-py.selectorLabels" -}}
app.kubernetes.io/name: {{ include "lettuce-py.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "lettuce-py.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "lettuce-py.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate the env+service prefix for secret names, e.g. dev_lettuce-py_
*/}}
{{- define "lettuce-py.envServicePrefix" -}}
{{- if .Values.envServicePrefix }}
{{- .Values.envServicePrefix -}}
{{- else -}}
{{- printf "%s_%s_" .Values.lettaEnv .Chart.Name -}}
{{- end }}
{{- end }}

{{/*
Generate the k8s safe (RFC1035 compliant) env+service prefix for secret names, i.e. no underscores and lowercase
*/}}
{{- define "lettuce-py.k8sEnvServicePrefix" -}}
{{- if .Values.envServicePrefix }}
{{- .Values.envServicePrefix | replace "_" "-" | lower -}}
{{- else -}}
{{- printf "%s_%s_" .Values.lettaEnv .Chart.Name | replace "_" "-" | lower -}}
{{- end }}
{{- end }}
