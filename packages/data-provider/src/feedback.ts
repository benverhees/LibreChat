export type TFeedbackRating = 'thumbsUp' | 'thumbsDown' | undefined;

export type TFeedbackContent = {
  tags?: TFeedbackTag[];
  text?: string;
};

export const feedbackTags = {
  thumbsDown: [
    'com_ui_feedback_tag_memory',
    'com_ui_feedback_tag_style',
    'com_ui_feedback_tag_incorrect',
    'com_ui_feedback_tag_instructions',
    'com_ui_feedback_tag_refused',
    'com_ui_feedback_tag_lazy',
    'com_ui_feedback_tag_unsafe',
    'com_ui_feedback_tag_biased',
    'com_ui_feedback_tag_other',
  ],
  thumbsUp: [
    'com_ui_feedback_tag_helpful',
    'com_ui_feedback_tag_clear',
    'com_ui_feedback_tag_concise',
    'com_ui_feedback_tag_creative',
    'com_ui_feedback_tag_knowledgeable',
    'com_ui_feedback_tag_engaging',
    'com_ui_feedback_tag_other',
  ]
} as const;

export type TFeedbackTag = typeof feedbackTags.thumbsDown[number] | typeof feedbackTags.thumbsUp[number];
