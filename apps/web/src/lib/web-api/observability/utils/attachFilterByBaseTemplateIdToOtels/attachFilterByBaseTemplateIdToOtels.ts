interface AttachOptions {
  baseTemplateId?: string;
}

export function attachFilterByBaseTemplateIdToOtels({
  baseTemplateId,
}: AttachOptions) {
  if (!baseTemplateId) {
    return '';
  }

  return ` AND SpanAttributes['base_template.id'] = {baseTemplateId: String} `;
}
