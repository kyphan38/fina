import Page from '@/components/Page';
import SettingsView from '@/components/SettingsView';
import TopBar from '@/components/TopBar';

export default function SettingsPage() {
  return (
    <Page
      top={
        <TopBar settings>
          <h1 className="text-xl font-semibold">Settings</h1>
        </TopBar>
      }
    >
      <SettingsView />
    </Page>
  );
}
