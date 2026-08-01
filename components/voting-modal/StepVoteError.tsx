import React from 'react';
import { View, Text, TouchableOpacity, LayoutChangeEvent, Dimensions } from 'react-native';
import LottieView from 'lottie-react-native';
import { createModalStyles, createStepSpecificStyles } from './styles';
import { useColors } from '@/constants/theme';
import { useTranslation } from 'react-i18next';
import { ErrorReportButton } from '@/components/ErrorReportButton';

interface StepVoteErrorProps {
  onGoHome?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  errorReason?: string | null;
  error?: unknown;
}

// Percentage heights on this view's children resolve unpredictably against
// the flex parent (Android collapses to 0, iOS resolves to 0 because the
// parent has no defined height). Use a concrete minHeight on both platforms
// instead of `height: '100%'` so step11/12 slides paint at usable height
// (otherwise the LottieView animation, title text, and CTA button all stack
// around y=0).
const SLIDE_MIN_HEIGHT = Math.round(Dimensions.get('window').height * 0.75);

const StepVoteError: React.FC<StepVoteErrorProps> = ({ onGoHome, onLayout, errorReason, error }) => {
  const { t } = useTranslation();
  const colors = useColors();
  const modalStyles = createModalStyles(colors);
  const stepSpecificStyles = createStepSpecificStyles(colors);
  return (
    <View
      style={[
        { width: '100%', minHeight: SLIDE_MIN_HEIGHT },
      ]}
      onLayout={onLayout}
    >
      <View style={stepSpecificStyles.stepVoteErrorContainer}>
        <View style={stepSpecificStyles.stepVoteErrorContent}>
          <Text style={stepSpecificStyles.stepVoteErrorTitle}>
            {t('voting.step12ErrorTitle')}
          </Text>

          <Text style={stepSpecificStyles.stepVoteErrorDescription}>
            {errorReason || t('voting.step12ErrorDescription')}
          </Text>

          <LottieView
            source={require('@/assets/animations/error.json')}
            style={stepSpecificStyles.stepVoteErrorAnimation}
            autoPlay
            loop={false}
          />

          {error != null && (
            <ErrorReportButton error={error} context={{ step: 12, reason: errorReason ?? null }} />
          )}
        </View>

        <TouchableOpacity
          style={stepSpecificStyles.stepVoteErrorButton}
          activeOpacity={0.8}
          onPress={onGoHome || (() => console.log('Go home'))}
        >
          <Text style={stepSpecificStyles.stepVoteErrorButtonText}>{t('common.backToHome')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default StepVoteError;
