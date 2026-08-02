// ============================================================
// 数字产品系统 - 主布局组件
// ============================================================

import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Space, Typography, Select } from 'antd';
import {
  HomeOutlined,
  GatewayOutlined,
  ShopOutlined,
  NodeIndexOutlined,
  ExperimentOutlined,
  UserOutlined,
  BellOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import type { UserRole } from '../../types';
import styles from './MainLayout.module.css';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
  currentUser?: {
    name: string;
    role: UserRole;
  };
  onRoleChange?: (role: UserRole) => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  IT_ARCHITECT: 'IT 数据架构师',
  PRODUCT_ARCHITECT: '产品数据架构师',
  PRODUCT_ENGINEER: '产品数据工程师',
};

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  IT_ARCHITECT: <ExperimentOutlined />,
  PRODUCT_ARCHITECT: <GatewayOutlined />,
  PRODUCT_ENGINEER: <ShopOutlined />,
};

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  currentUser = { name: '张工程师', role: 'PRODUCT_ENGINEER' },
  onRoleChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '产品总览',
    },
    {
      key: '/template',
      icon: <ExperimentOutlined />,
      label: '模板建模',
    },
    {
      key: '/model',
      icon: <GatewayOutlined />,
      label: '产品建模',
    },
      {
      key: '/instance',
      icon: <ShopOutlined />,
      label: '产品实例化',
    },
    {
      key: '/explore',
      icon: <NodeIndexOutlined />,
      label: '数据探索',
    },
  ];

  const userMenuItems = [
    { key: 'profile', label: '个人设置' },
    { key: 'preferences', label: '偏好设置' },
    { type: 'divider' as const },
    { key: 'logout', label: '退出登录' },
  ];

  return (
    <Layout className={styles.layout}>
      {/* 顶部导航 */}
      <Header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#1890ff"/>
              <path d="M8 16L16 8L24 16L16 24L8 16Z" fill="white" fillOpacity="0.9"/>
              <circle cx="16" cy="16" r="4" fill="#1890ff"/>
            </svg>
            <span className={styles.logoText}>数字产品建模</span>
          </div>
        </div>

        <div className={styles.headerCenter}>
          {/* 角色切换 */}
          <Select
            value={currentUser.role}
            onChange={(val) => onRoleChange?.(val as UserRole)}
            size="small"
            style={{ width: 180 }}
            suffixIcon={ROLE_ICONS[currentUser.role]}
          >
            <Select.Option value="IT_ARCHITECT">
              <Space>
                <ExperimentOutlined />
                IT 数据架构师
              </Space>
            </Select.Option>
            <Select.Option value="PRODUCT_ARCHITECT">
              <Space>
                <GatewayOutlined />
                产品数据架构师
              </Space>
            </Select.Option>
            <Select.Option value="PRODUCT_ENGINEER">
              <Space>
                <ShopOutlined />
                产品数据工程师
              </Space>
            </Select.Option>
          </Select>
        </div>

        <div className={styles.headerRight}>
          <Badge count={3} size="small">
            <BellOutlined className={styles.headerIcon} />
          </Badge>
          <QuestionCircleOutlined className={styles.headerIcon} />
          <SettingOutlined className={styles.headerIcon} />
          
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space className={styles.userInfo}>
              <Avatar size="small" icon={<UserOutlined />} />
              <Text className={styles.userName}>{currentUser.name}</Text>
            </Space>
          </Dropdown>
        </div>
      </Header>

      <Layout>
        {/* 侧边导航 */}
        <Sider width={220} className={styles.sider}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            className={styles.menu}
          />

          {/* 阶段指示器 */}
          <div className={styles.phaseIndicator}>
            <div className={styles.phaseTitle}>当前阶段</div>
            <div className={styles.phaseSteps}>
              <div className={`${styles.phaseStep} ${location.pathname === '/template' ? styles.active : ''}`}>
                <div className={styles.stepNumber}>1</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepName}>模板建模</div>
                  <div className={styles.stepRole}>IT架构师</div>
                </div>
              </div>
              <div className={styles.phaseLine} />
              <div className={`${styles.phaseStep} ${location.pathname === '/model' ? styles.active : ''}`}>
                <div className={styles.stepNumber}>2</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepName}>产品模型</div>
                  <div className={styles.stepRole}>产品架构师</div>
                </div>
              </div>
              <div className={styles.phaseLine} />
              <div className={`${styles.phaseStep} ${location.pathname === '/instance' ? styles.active : ''}`}>
                <div className={styles.stepNumber}>3</div>
                <div className={styles.stepContent}>
                  <div className={styles.stepName}>产品实例化</div>
                  <div className={styles.stepRole}>数据工程师</div>
                </div>
              </div>
            </div>
          </div>
        </Sider>

        {/* 主内容区 */}
        <Content className={styles.content}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
