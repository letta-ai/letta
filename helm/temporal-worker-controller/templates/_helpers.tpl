{{/*
Common labels
*/}}
{{- define "temporal-worker-controller.labels" -}}
{{ include "temporal-worker-controller.selectorLabels" $ }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "temporal-worker-controller.selectorLabels" -}}
app.kubernetes.io/name: temporal-worker-controller
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
