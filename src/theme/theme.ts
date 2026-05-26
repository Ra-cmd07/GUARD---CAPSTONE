import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main:          '#0b4d79',
      light:         '#3b82f6',
      dark:          '#062d48',
      contrastText:  '#ffffff',
    },
    secondary: {
      main:         '#fbc02d',
      contrastText: '#000000',
    },
    success: { main: '#28a745' },
    warning: { main: '#ff9800' },
    error:   { main: '#dc3545' },
    info:    { main: '#17a2b8' },
    background: {
      default: '#f5f5f5',
      paper:   '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight:    600,
          minHeight:     44,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          background: '#0b4d79',
          color:      '#ffffff',
        },
      },
    },
  },
});

export default theme;
