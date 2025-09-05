import React from 'react';
import styled from 'styled-components';
import { Layout } from '../components/Layout.tsx';

const ScannerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
  padding-top: 40px;
`;

const ReceiptArea = styled.div`
  width: 200px;
  height: 280px;
  border: 3px solid #000;
  background: white;
  padding: 15px;
  display: flex;
  flex-direction: column;
`;

const ReceiptHeader = styled.div`
  text-align: center;
  font-weight: bold;
  margin-bottom: 10px;
  border-bottom: 1px dashed #000;
  padding-bottom: 10px;
`;

const ReceiptItem = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin-bottom: 5px;
`;

const ReceiptFooter = styled.div`
  margin-top: auto;
  text-align: center;
  font-size: 10px;
  border-top: 1px dashed #000;
  padding-top: 10px;
`;

const Instructions = styled.div`
  text-align: center;
  color: #666;
  font-size: 16px;
`;

export const ReceiptScanner: React.FC = () => {
  return (
    <Layout title="Receipt Scanning">
      <ScannerContainer>
        <ReceiptArea>
          <ReceiptHeader>MINI PARADISE</ReceiptHeader>
          
          <ReceiptItem>
            <span>SELF PAR SL</span>
            <span>5.50</span>
          </ReceiptItem>
          <ReceiptItem>
            <span>Baguette BREAD</span>
            <span>2.30</span>
          </ReceiptItem>
          <ReceiptItem>
            <span>VEG Oil</span>
            <span>6.70</span>
          </ReceiptItem>
          <ReceiptItem>
            <span>Hand pie</span>
            <span>1.80</span>
          </ReceiptItem>
          <ReceiptItem>
            <span>GENERAL</span>
            <span>29.75</span>
          </ReceiptItem>
          
          <ReceiptFooter>
            <div>TOTAL: 29.35</div>
            <div>RECEIPT No: 16539</div>
          </ReceiptFooter>
        </ReceiptArea>
        
        <Instructions>
          Take a photo of your receipt to add multiple items at once
        </Instructions>
      </ScannerContainer>
    </Layout>
  );
};