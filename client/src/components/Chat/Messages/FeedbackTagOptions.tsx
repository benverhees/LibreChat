import { ThumbsUp, ThumbsDown, X, Check, Trash2 } from 'lucide-react';
import { feedbackTags, TFeedbackTag, TFeedbackRating, TMessageFeedback } from 'librechat-data-provider';
import * as Popover from '@radix-ui/react-popover';
import { useLocalize, type TranslationKeys } from '~/hooks';
import { cn } from '~/utils';
import React, { useState, useEffect, useRef } from 'react';

interface FeedbackTagOptionsProps {
  feedback: TMessageFeedback;
  onChange: (feedback: TMessageFeedback) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Get detailed option button style based on selection status and rating
const getOptionStyle = (selected: boolean, rating: TFeedbackRating) => {
  if (selected) {
    if (rating === 'thumbsUp') {
      return 'bg-green-200 text-green-700 border-green-500 dark:bg-green-600/50 dark:text-green-300 dark:border-green-500';
    } else if (rating === 'thumbsDown') {
      return 'bg-red-200 text-red-700 border-red-500 dark:bg-red-600/50 dark:text-red-300 dark:border-red-500';
    }
  }
  return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-850 dark:border-gray-600';
};

export default function FeedbackTagOptions({
  feedback,
  onChange,
  open,
  onOpenChange
}: FeedbackTagOptionsProps) {
  const localize = useLocalize();
  const [localText, setLocalText] = useState('');
  const [hasTextChanged, setHasTextChanged] = useState(false);

  // Sync local text state with feedback text when feedback changes
  useEffect(() => {
    setLocalText(feedback.ratingContent?.text ?? '');
    setHasTextChanged(false);
  }, [feedback.ratingContent?.text, open]);

  // Update local text without saving to API
  const handleTextChange = (value: string) => {
    setLocalText(value);
    setHasTextChanged(true);
  };

  // Handle submit (check button click)
  const handleSubmit = () => {
    // Only update if the text has changed
    if (hasTextChanged) {
      const updatedRatingContent = {
        tags: feedback.ratingContent?.tags ?? [],
        text: localText
      };
      
      onChange({
        ...feedback,
        ratingContent: updatedRatingContent
      });
    }
    
    // Close the panel
    onOpenChange(false);
  };

  if (!feedback.rating) {
    return null;
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Anchor className="absolute h-7" />
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[700px] rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-700"
          side="top"
          sideOffset={5}
          align="start"
        >
          <div className="flex items-start">
            <div className={cn(
              'flex-shrink-0 mr-3',
              feedback.rating === 'thumbsUp' 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            )}>
              {feedback.rating === 'thumbsUp' 
                ? <ThumbsUp /> 
                : <ThumbsDown />
              }
            </div>
            
            <div className="flex-grow">
              <div className="flex justify-between items-center mb-2">
                <span className={cn(
                  'font-medium',
                  feedback.rating === 'thumbsUp' 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                )}>
                  {localize('com_ui_feedback_tag_options')}
                </span>
                <Popover.Close className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <X size={14} className="text-gray-500 dark:text-gray-400" />
                </Popover.Close>
              </div>
              
              <div className="flex-1">
                <div className="flex flex-wrap gap-1 items-center mb-2">
                  {(feedback.rating === 'thumbsUp' ? feedbackTags.thumbsUp : feedbackTags.thumbsDown).map((tag: TFeedbackTag) => (
                    <label
                      key={tag}
                      htmlFor={`feedback-option-${tag}`}
                      className={cn(
                        'px-4 py-2 rounded-full transition-colors duration-150 cursor-pointer select-none font-medium text-xs border min-h-[44px] min-w-[44px] flex items-center justify-center',
                        '[&:has(:focus-visible)]:outline [&:has(:focus-visible)]:outline-2 [&:has(:focus-visible)]:outline-offset-2 [&:has(:focus-visible)]:outline-white',
                        getOptionStyle(feedback.ratingContent?.tags?.includes(tag) ?? false, feedback.rating)
                      )}
                    >
                      <input 
                        id={`feedback-option-${tag}`}
                        type="checkbox"
                        className="sr-only"
                        checked={feedback.ratingContent?.tags?.includes(tag) ?? false}
                        onChange={(e) => {
                          const currentTags = feedback.ratingContent?.tags ?? [];
                          const newTags = e.target.checked 
                            ? [...currentTags, tag] 
                            : currentTags.filter(t => t !== tag);
                          
                          const updatedRatingContent = {
                            tags: newTags,
                            text: feedback.ratingContent?.text ?? ''
                          };
                          
                          onChange({ 
                            ...feedback, 
                            ratingContent: updatedRatingContent
                          });
                        }}
                        aria-label={localize(tag)}
                      />
                      <span>{localize(tag as TranslationKeys)}</span>
                    </label>
                  ))}
                  <div className="flex gap-2 ml-auto">
                    <button 
                      onClick={() => onChange({ rating: undefined, ratingContent: undefined })}
                      className={cn(
                        'p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-full',
                        'transition-colors duration-150 flex items-center justify-center',
                        'h-11 w-11 flex-shrink-0'
                      )}
                    >
                      <Trash2 size={20} className="-translate-y-[1px]" />
                    </button>
                    <button 
                      onClick={handleSubmit}
                      className={cn(
                        'p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full',
                        'transition-colors duration-150 flex items-center justify-center',
                        'h-11 w-11 flex-shrink-0'
                      )}
                    >
                      <Check size={20} className="-translate-y-[1px]" />
                    </button>
                  </div>
                </div>

                {feedback.ratingContent?.tags?.includes('com_ui_feedback_tag_other') && (
                  <div className="mb-4">
                    <textarea 
                      value={localText}
                      onChange={e => handleTextChange(e.target.value)}
                      className="w-full p-2 text-xs border border-gray-300 dark:border-gray-600 rounded-2xl focus:ring-1 focus:ring-blue-300 dark:focus:ring-blue-700 focus:border-blue-300 dark:focus:border-blue-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 resize-none"
                      rows={5}
                      placeholder={localize('com_ui_feedback_more_information')}
                      aria-label={localize('com_ui_feedback_more_information')}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
} 