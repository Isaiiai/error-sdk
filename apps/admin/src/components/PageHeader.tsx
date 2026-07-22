import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { brand, signalGradient } from '../theme';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

/** Shared page title band with signal-rail accent */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', sm: 'flex-end' },
        gap: 2,
        flexWrap: 'wrap',
        mb: 3,
        pb: 2.5,
        borderBottom: `1px solid ${brand.border}`,
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          left: 0,
          bottom: -1,
          width: 72,
          height: 2,
          background: signalGradient,
          borderRadius: 1,
        },
      }}
    >
      <Box sx={{ minWidth: 0, pl: 1.75, borderLeft: `3px solid ${brand.magenta}` }}>
        {eyebrow && (
          <Typography
            variant="overline"
            sx={{ color: brand.muted, display: 'block', mb: 0.35 }}
          >
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 520 }}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
