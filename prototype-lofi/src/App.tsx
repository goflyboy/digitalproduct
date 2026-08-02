// ============================================================
// 数字产品系统 - 主应用入口
// ============================================================

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { MainLayout } from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import TemplateModelingPage from './pages/TemplateModelingPage';
import ProductModelPage from './pages/ProductModelPage';
import InstancePage from './pages/InstancePage';
import ExplorePage from './pages/ExplorePage';

// Ant Design 浅色主题配置（清新科技风）
const lightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#2b6de1',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBorder: '#dde5f4',
    colorBorderSecondary: '#e8eefb',
    colorText: '#1a1f36',
    colorTextSecondary: '#6b7594',
    colorTextTertiary: '#8a93b8',
    borderRadius: 6,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    Menu: {
      darkItemBg: 'transparent',
      darkItemSelectedBg: 'rgba(43, 109, 225, 0.18)',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
    },
    Card: {
      colorBgContainer: '#ffffff',
    },
    Table: {
      colorBgContainer: 'transparent',
      headerBg: '#f0f4fb',
    },
    Drawer: {
      colorBgElevated: '#f8fafd',
    },
    Modal: {
      contentBg: '#ffffff',
      headerBg: '#ffffff',
    },
  },
};

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={lightTheme}
      locale={zhCN}
    >
      <BrowserRouter>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/template" element={<TemplateModelingPage />} />
            <Route path="/model" element={<ProductModelPage />} />
            <Route path="/instance" element={<InstancePage />} />
            <Route path="/explore" element={<ExplorePage />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
