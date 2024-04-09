import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';

export const ManagePage: FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-2">
      <header className="h-10 mb-4 relative flex items-center justify-center">
        <Button
          className="absolute left-0"
          onClick={() => {
            navigate('/', { replace: true });
          }}
          variant="ghost"
        >
          <ArrowLeft />
        </Button>
        <h1 className="text-lg font-semibold">Manage corpora</h1>
      </header>
      <main></main>
    </div>
  );
};
