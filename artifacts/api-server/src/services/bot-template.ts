export type BotTemplateFile = {
  path: string;
  content: string;
};

declare const __BOT_TEMPLATE_FILES__: string;

export const botTemplateFiles = JSON.parse(
  __BOT_TEMPLATE_FILES__,
) as BotTemplateFile[];