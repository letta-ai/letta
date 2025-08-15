{{/*
Expand the name of the chart.
*/}}
{{- define "memgpt-server.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "memgpt-server.fullname" -}}
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
{{- define "memgpt-server.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "memgpt-server.labels" -}}
helm.sh/chart: {{ include "memgpt-server.chart" . }}
{{ include "memgpt-server.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "memgpt-server.selectorLabels" -}}
app.kubernetes.io/name: {{ include "memgpt-server.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "memgpt-server.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "memgpt-server.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Generate the env+service prefix for secret names, e.g. dev_memgpt-server_
*/}}
{{- define "memgpt-server.envServicePrefix" -}}
{{- if .Values.envServicePrefix }}
{{- .Values.envServicePrefix -}}
{{- else -}}
{{- printf "%s_%s_" .Values.lettaEnv .Chart.Name -}}
{{- end }}
{{- end }}

{{/*
Generate the k8s safe (RFC1035 compliant) env+service prefix for secret names, i.e. no underscores and lowercase
*/}}
{{- define "memgpt-server.k8sEnvServicePrefix" -}}
{{- if .Values.envServicePrefix }}
{{- .Values.envServicePrefix | replace "_" "-" | lower -}}
{{- else -}}
{{- printf "%s_%s_" .Values.lettaEnv .Chart.Name | replace "_" "-" | lower -}}
{{- end }}
{{- end }}
