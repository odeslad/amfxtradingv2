import { POSITION_COLOR_VALUES, nextColor, type PositionColor } from './utils/position';
import { apiSend, errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import styles from './ColorBadge.module.css';

interface ColorBadgeProps {
  broker: string;
  ticket: number;
  color?: string;
  onColorChange: (broker: string, ticket: number, color: string) => void;
}

export function ColorBadge({ broker, ticket, color, onColorChange }: ColorBadgeProps) {
  const next = nextColor(color);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onColorChange(broker, ticket, next);
    try {
      await apiSend('/positions/color', 'PATCH', { broker, ticket, color: next });
    } catch (err) {
      onColorChange(broker, ticket, color ?? '');
      addToast(errorMessage(err, 'Failed to save colour'), 'error');
    }
  };

  const cssColor = color ? POSITION_COLOR_VALUES[color as PositionColor] : undefined;

  return (
    <button
      type="button"
      className={styles.badge}
      onClick={handleClick}
      style={cssColor ? { background: cssColor, borderColor: cssColor } : undefined}
      title={color || 'Add color'}
      aria-label="Color group"
    />
  );
}
