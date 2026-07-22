import { Box, Typography } from '@mui/material';
import { brand } from '../theme';

type MetricTileProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
};

export function MetricTile({
  label,
  value,
  hint,
  accent = brand.magenta,
}: MetricTileProps) {
  return (
    <Box
      sx={{
        height: '100%',
        p: 2.25,
        bgcolor: brand.paper,
        border: `1px solid ${brand.border}`,
        borderRadius: 2,
        borderLeft: `3px solid ${accent}`,
        transition: 'border-color .15s ease, transform .15s ease',
        '@media (prefers-reduced-motion: no-preference)': {
          '&:hover': {
            borderColor: accent,
            transform: 'translateY(-1px)',
          },
        },
      }}
    >
      <Typography
        variant="overline"
        sx={{ color: brand.muted, display: 'block', lineHeight: 1.2 }}
      >
        {label}
      </Typography>
      <Typography
        variant="h3"
        sx={{
          mt: 0.75,
          fontSize: { xs: 26, md: 32 },
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.04em',
        }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}
