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

// Ant Design 暗色主题配置
const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#1890ff',
    colorBgContainer: '#1a1a2e',
    colorBgElevated: '#1a1a2e',
    colorBorder: '#2a2a4c',
    colorBorderSecondary: '#3a3a5c',
    colorText: '#e0e0e0',
    colorTextSecondary: '#8888aa',
    colorTextTertiary: '#6666888',
    borderRadius: 6,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    Menu: {
      darkItemBg: 'transparent',
      darkItemSelectedBg: 'rgba(24, 144, 255, 0.15)',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.05)',
    },
    Card: {
      colorBgContainer: '#1a1a2e',
    },
    Table: {
      colorBgContainer: 'transparent',
      headerBg: '#2a2a4c',
    },
    Drawer: {
      colorBgElevated: '#1a1a2e',
    },
    Modal: {
      contentBg: '#1a1a2e',
      headerBg: '#1a1a2e',
    },
  },
};

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={darkTheme}
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
