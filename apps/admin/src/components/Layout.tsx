import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  AppBar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  ButtonBase,
  Divider,
  Tooltip,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BugReportIcon from '@mui/icons-material/BugReport';
import FolderIcon from '@mui/icons-material/Folder';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import BuildIcon from '@mui/icons-material/Build';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { useState, useMemo, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { logout } from '../store/authSlice';
import { usePermissions, ROLE_LABELS, type Permission } from '../rbac';
import { brand, signalGradient } from '../theme';

const MOBILE_DRAWER_WIDTH = 300;

const navItems: Array<{
  label: string;
  path: string;
  icon: ReactNode;
  permission?: Permission;
  group: 'monitor' | 'manage';
}> = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon sx={{ fontSize: 18 }} />, group: 'monitor' },
  { label: 'Errors', path: '/errors', icon: <BugReportIcon sx={{ fontSize: 18 }} />, permission: 'errors:read', group: 'monitor' },
  { label: 'Analytics', path: '/analytics', icon: <AnalyticsIcon sx={{ fontSize: 18 }} />, permission: 'analytics:read', group: 'monitor' },
  { label: 'Tickets', path: '/tickets', icon: <ConfirmationNumberIcon sx={{ fontSize: 18 }} />, permission: 'tickets:read', group: 'monitor' },
  { label: 'Projects', path: '/projects', icon: <FolderIcon sx={{ fontSize: 18 }} />, group: 'manage' },
  { label: 'Maintenance', path: '/maintenance', icon: <BuildIcon sx={{ fontSize: 18 }} />, permission: 'maintenance:read', group: 'manage' },
  { label: 'Users', path: '/users', icon: <PeopleIcon sx={{ fontSize: 18 }} />, permission: 'users:manage', group: 'manage' },
];

export function ProtectedRoute() {
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function isActivePath(pathname: string, path: string) {
  return path === '/' ? pathname === '/' : pathname.startsWith(path);
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const user = useSelector((s: RootState) => s.auth.user);
  const { can, role } = usePermissions();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = useMemo(
    () => navItems.filter((item) => !item.permission || can(item.permission)),
    [can]
  );

  const handleLogout = () => {
    setAnchorEl(null);
    dispatch(logout());
    navigate('/login');
  };

  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const roleChipSx = {
    fontWeight: 650,
    height: 26,
    borderRadius: 1,
    fontSize: 12,
    bgcolor:
      role === 'admin'
        ? alpha(brand.magenta, 0.16)
        : role === 'product_manager'
          ? alpha(brand.cobalt, 0.16)
          : alpha('#fff', 0.08),
    color:
      role === 'admin'
        ? brand.magentaSoft
        : role === 'product_manager'
          ? '#93C5FD'
          : alpha('#fff', 0.8),
    border: '1px solid',
    borderColor:
      role === 'admin'
        ? alpha(brand.magenta, 0.35)
        : role === 'product_manager'
          ? alpha(brand.cobalt, 0.35)
          : alpha('#fff', 0.12),
  };

  const navButton = (item: (typeof navItems)[number]) => {
    const active = isActivePath(location.pathname, item.path);
    return (
      <ButtonBase
        key={item.path}
        onClick={() => go(item.path)}
        disableRipple
        sx={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 1.1,
          color: active ? '#fff' : alpha('#fff', 0.58),
          fontWeight: active ? 650 : 500,
          fontSize: 13.5,
          letterSpacing: '-0.01em',
          fontFamily: '"IBM Plex Sans", sans-serif',
          transition: 'color .15s ease',
          '&:hover': { color: '#fff' },
          '&:focus-visible': {
            outline: `2px solid ${brand.teal}`,
            outlineOffset: 2,
            borderRadius: 1,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 8,
            right: 8,
            bottom: 0,
            height: 2,
            borderRadius: 1,
            background: active ? signalGradient : 'transparent',
            transition: 'background .15s ease',
          },
        }}
      >
        <Box sx={{ display: 'flex', opacity: active ? 1 : 0.7, lineHeight: 0 }}>{item.icon}</Box>
        {item.label}
      </ButtonBase>
    );
  };

  const mobileDrawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: brand.ink, color: '#fff' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box
            component="img"
            src="/isaii-logo.png"
            alt="Isaii AI"
            sx={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 1, bgcolor: '#fff', p: 0.35 }}
          />
          <Box>
            <Typography sx={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: 16, lineHeight: 1.1 }}>
              Isaii AI
            </Typography>
            <Typography variant="caption" sx={{ color: alpha('#fff', 0.45), fontFamily: '"IBM Plex Mono", monospace' }}>
              ERROR TRACKER
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={() => setMobileOpen(false)} sx={{ color: alpha('#fff', 0.7) }} aria-label="Close menu">
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ height: 2, background: signalGradient, opacity: 0.9 }} />
      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {(['monitor', 'manage'] as const).map((group) => {
          const items = visibleNav.filter((i) => i.group === group);
          if (!items.length) return null;
          return (
            <Box key={group} sx={{ mb: 2.5 }}>
              <Typography
                variant="overline"
                sx={{
                  px: 1.25,
                  mb: 0.75,
                  display: 'block',
                  color: alpha('#fff', 0.38),
                }}
              >
                {group}
              </Typography>
              {items.map((item) => {
                const active = isActivePath(location.pathname, item.path);
                return (
                  <ListItemButton
                    key={item.path}
                    selected={active}
                    onClick={() => go(item.path)}
                    sx={{
                      borderRadius: 1.5,
                      mb: 0.4,
                      color: alpha('#fff', 0.72),
                      borderLeft: active ? `3px solid ${brand.magenta}` : '3px solid transparent',
                      '& .MuiListItemIcon-root': { color: alpha('#fff', 0.5), minWidth: 36 },
                      '&.Mui-selected': {
                        bgcolor: alpha('#fff', 0.08),
                        color: '#fff',
                        '& .MuiListItemIcon-root': { color: brand.magentaSoft },
                      },
                      '&:hover': { bgcolor: alpha('#fff', 0.06) },
                    }}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600, fontSize: 14 }} />
                  </ListItemButton>
                );
              })}
            </Box>
          );
        })}
      </List>
      <Box sx={{ p: 2, borderTop: `1px solid ${alpha('#fff', 0.08)}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              fontSize: 14,
              fontWeight: 700,
              bgcolor: brand.magenta,
            }}
          >
            {user?.fullName?.[0] || 'U'}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" noWrap fontWeight={650}>
              {user?.fullName}
            </Typography>
            <Typography variant="caption" noWrap sx={{ color: alpha('#fff', 0.45) }}>
              {user?.email}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: brand.ink,
          color: '#fff',
          borderBottom: 'none',
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, md: 58 },
            gap: 1,
            px: { xs: 1.5, md: 3 },
          }}
        >
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ color: '#fff', mr: 0.25 }} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
          )}

          <Box
            onClick={() => go('/')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.15,
              cursor: 'pointer',
              mr: { md: 2.5 },
              flexShrink: 0,
              '&:focus-visible': {
                outline: `2px solid ${brand.teal}`,
                outlineOffset: 3,
                borderRadius: 1,
              },
            }}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') go('/');
            }}
            role="link"
            aria-label="Isaii AI home"
          >
            <Box
              component="img"
              src="/isaii-logo.png"
              alt=""
              sx={{
                width: 30,
                height: 30,
                objectFit: 'contain',
                borderRadius: 0.75,
                bgcolor: '#fff',
                p: 0.3,
              }}
            />
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography
                sx={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                }}
              >
                Isaii AI
              </Typography>
              <Typography
                sx={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  color: alpha('#fff', 0.42),
                  lineHeight: 1.2,
                  mt: 0.15,
                }}
              >
                ERROR TRACKER
              </Typography>
            </Box>
          </Box>

          {!isMobile && (
            <Box
              component="nav"
              aria-label="Primary"
              sx={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 0.15,
                flex: 1,
                minWidth: 0,
                overflowX: 'auto',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
                alignSelf: 'stretch',
              }}
            >
              {visibleNav.map(navButton)}
            </Box>
          )}

          {isMobile && <Box sx={{ flex: 1 }} />}

          <Chip size="small" label={ROLE_LABELS[role] || role} sx={roleChipSx} />

          <Tooltip title="Account">
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small" sx={{ p: 0.25 }} aria-label="Account menu">
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: 13,
                  fontWeight: 700,
                  bgcolor: brand.magenta,
                  border: `1px solid ${alpha('#fff', 0.2)}`,
                }}
              >
                {user?.fullName?.[0] || 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={!!anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
              sx: {
                mt: 1.25,
                minWidth: 240,
                borderRadius: 2,
                border: `1px solid ${brand.border}`,
                overflow: 'hidden',
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.75 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {user?.fullName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Chip size="small" label={ROLE_LABELS[role] || role} variant="outlined" color="primary" />
              </Box>
            </Box>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main', py: 1.25 }}>
              <ListItemIcon sx={{ color: 'inherit' }}>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Log out
            </MenuItem>
          </Menu>
        </Toolbar>
        {/* Signature: signal beam */}
        <Box
          aria-hidden
          sx={{
            height: 2,
            background: signalGradient,
            opacity: 0.95,
          }}
        />
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: MOBILE_DRAWER_WIDTH,
            border: 'none',
            boxSizing: 'border-box',
          },
        }}
      >
        {mobileDrawer}
      </Drawer>

      <Box
        component="main"
        sx={{
          pt: { xs: '66px', md: '68px' },
          px: { xs: 2, md: 3.5 },
          pb: { xs: 3, md: 4 },
          minHeight: '100vh',
          maxWidth: 1400,
          mx: 'auto',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
