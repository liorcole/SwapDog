import React from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';

interface Props {
  uri?: string;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  isDecorative?: boolean;
}

const CachedImage: React.FC<Props> = ({ uri, style, containerStyle, accessibilityLabel, isDecorative = false }) => {
  return (
    <View style={containerStyle}>
      <Image
        source={uri ? { uri } : require('../../../assets/icon.png')}
        style={style}
        accessibilityLabel={isDecorative ? undefined : accessibilityLabel ?? 'Image'}
        accessibilityElementsHidden={isDecorative}
        importantForAccessibility={isDecorative ? 'no-hide-descendants' : 'yes'}
      />
    </View>
  );
};

export default CachedImage;
