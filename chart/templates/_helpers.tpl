{{/*
Expand the name of the chart.
*/}}
{{- define "letta.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "letta.fullname" -}}
{{- if .Values.nameOverride }}
{{- .Values.nameOverride | trunc 63 | trimSuffix "-" }}
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
{{- define "letta.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "letta.labels" -}}
helm.sh/chart: {{ include "letta.chart" . }}
{{ include "letta.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "letta.selectorLabels" -}}
app.kubernetes.io/name: {{ include "letta.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database labels
*/}}
{{- define "letta.db.labels" -}}
{{ include "letta.labels" . }}
app.kubernetes.io/component: database
{{- end }}

{{/*
Server labels
*/}}
{{- define "letta.server.labels" -}}
{{ include "letta.labels" . }}
app.kubernetes.io/component: server
{{- end }}

{{/*
Nginx labels
*/}}
{{- define "letta.nginx.labels" -}}
{{ include "letta.labels" . }}
app.kubernetes.io/component: nginx
{{- end }}

{{/*
Database selector labels
*/}}
{{- define "letta.db.selectorLabels" -}}
{{ include "letta.selectorLabels" . }}
app.kubernetes.io/component: database
{{- end }}

{{/*
Server selector labels
*/}}
{{- define "letta.server.selectorLabels" -}}
{{ include "letta.selectorLabels" . }}
app.kubernetes.io/component: server
{{- end }}

{{/*
Nginx selector labels
*/}}
{{- define "letta.nginx.selectorLabels" -}}
{{ include "letta.selectorLabels" . }}
app.kubernetes.io/component: nginx
{{- end }}

{{/*
Database host
*/}}
{{- define "letta.db.host" -}}
{{- if .Values.externalDatabase.enabled }}
{{- .Values.externalDatabase.host }}
{{- else }}
{{- printf "%s-db" (include "letta.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Database user
*/}}
{{- define "letta.db.user" -}}
{{- if .Values.externalDatabase.enabled }}
{{- .Values.externalDatabase.user }}
{{- else }}
{{- .Values.database.postgres.user }}
{{- end }}
{{- end }}

{{/*
Database password
*/}}
{{- define "letta.db.password" -}}
{{- if .Values.externalDatabase.enabled }}
{{- .Values.externalDatabase.password }}
{{- else }}
{{- .Values.database.postgres.password }}
{{- end }}
{{- end }}

{{/*
Database name
*/}}
{{- define "letta.db.name" -}}
{{- if .Values.externalDatabase.enabled }}
{{- .Values.externalDatabase.database }}
{{- else }}
{{- .Values.database.postgres.database }}
{{- end }}
{{- end }}

{{/*
Database port
*/}}
{{- define "letta.db.port" -}}
{{- if .Values.externalDatabase.enabled }}
{{- .Values.externalDatabase.port }}
{{- else }}
{{- .Values.database.postgres.port }}
{{- end }}
{{- end }}

{{/*
Database connection string
*/}}
{{- define "letta.db.uri" -}}
{{- if .Values.externalDatabase.enabled -}}
{{- if .Values.externalDatabase.uri -}}
{{- .Values.externalDatabase.uri -}}
{{- else -}}
postgresql://{{ include "letta.db.user" . }}:{{ include "letta.db.password" . }}@{{ include "letta.db.host" . }}:{{ include "letta.db.port" . }}/{{ include "letta.db.name" . }}
{{- end -}}
{{- else -}}
postgresql://{{ include "letta.db.user" . }}:{{ include "letta.db.password" . }}@{{ include "letta.db.host" . }}:{{ include "letta.db.port" . }}/{{ include "letta.db.name" . }}
{{- end -}}
{{- end }}

{{/*
Service account name
*/}}
{{- define "letta.serviceAccountName" -}}
{{- if .Values.global.serviceAccount.create }}
{{- default (include "letta.fullname" .) .Values.global.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.global.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Secret name
*/}}
{{- define "letta.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else if .Values.secrets.create }}
{{- default (printf "%s-secrets" (include "letta.fullname" .)) .Values.secrets.name }}
{{- else }}
{{- "" }}
{{- end }}
{{- end }}

