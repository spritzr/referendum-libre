import React from 'react';
import { View, Text, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { PortalHost } from 'react-native-teleport';
import { createStepSpecificStyles } from './styles';
import { useColors } from '@/constants/theme';
import { useTranslation } from 'react-i18next';
import { FlowStep } from '@/constants/voting-flow-steps';
import { stepVideoHostName } from './stepVideoHostName';

interface StepIntroVideoProps {
  onSkip?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

const StepIntroVideo: React.FC<StepIntroVideoProps> = ({ onSkip, onLayout }) => {
  const { t } = useTranslation();
  const colors = useColors();
  const stepSpecificStyles = createStepSpecificStyles(colors);

  return (
    <View style={[{ width: '100%', flex: 1 }]} onLayout={onLayout}>
      <View style={stepSpecificStyles.stepIntroContainer}>
        <PortalHost
          name={stepVideoHostName(FlowStep.IntroVideo)}
          style={stepSpecificStyles.stepIntroVideo}
        />
        <TouchableOpacity
          style={stepSpecificStyles.stepIntroSkipButton}
          activeOpacity={0.8}
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel={t('common.skip')}
        >
          <Text style={stepSpecificStyles.stepIntroSkipButtonText}>{t('common.skip')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default StepIntroVideo;
