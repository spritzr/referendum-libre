import React from 'react';
import { View, Text, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { VideoView } from 'expo-video';
import { createStepSpecificStyles } from './styles';
import { useColors } from '@/constants/theme';
import { useTranslation } from 'react-i18next';

interface StepIntroVideoProps {
  player?: any;
  containerWidth: number;
  onSkip?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

const StepIntroVideo: React.FC<StepIntroVideoProps> = ({
  player,
  containerWidth,
  onSkip,
  onLayout,
}) => {
  const { t } = useTranslation();
  const colors = useColors();
  const stepSpecificStyles = createStepSpecificStyles(colors);

  return (
    <View style={[{ width: containerWidth }]} onLayout={onLayout}>
      <View style={stepSpecificStyles.stepIntroContainer}>
        <VideoView
          style={stepSpecificStyles.stepIntroVideo}
          player={player}
          contentFit="contain"
          nativeControls={false}
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
