interface WaybillItem {
  qty: string;
  reference: string;
  description: string;
}

interface WaybillTemplateProps {
  waybillNumber?: string;
  date: string;
  to: string;
  address: string;
  items: WaybillItem[];
  issuedBy?: string;
  receivedBy?: string;
}

export const WaybillTemplate = ({
  waybillNumber = "",
  date,
  to,
  address,
  items,
  issuedBy = "",
  receivedBy = "",
}: WaybillTemplateProps) => {
  // Ensure we have at least 15 rows for the template
  const tableRows = [...items];
  while (tableRows.length < 15) {
    tableRows.push({ qty: "", reference: "", description: "" });
  }

  return (
      <div className="waybill-template bg-white text-black" style={{ 
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm',
        boxSizing: 'border-box',
        fontFamily: 'Arial, sans-serif'
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: '#000', marginBottom: '16px' }}>apotica<span style={{ color: '#000' }}>A</span></h1>
            <div style={{ fontSize: '14px', lineHeight: '1.5', fontWeight: '500' }}>
              <div>#6 Osekere Street, Airport West</div>
              <div>Accra-Ghana</div>
              <div>T: +233.302.760.062</div>
              <div>E: www.apotica.net</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '16px', paddingTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontStyle: 'italic' }}>To:</span>
              <span style={{ borderBottom: '2px solid #000', minWidth: '300px', display: 'inline-block', textAlign: 'left' }}>{to}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontStyle: 'italic' }}>Address:</span>
              <span style={{ borderBottom: '2px solid #000', minWidth: '300px', display: 'inline-block', textAlign: 'left' }}>{address}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontStyle: 'italic' }}>Date:</span>
              <span style={{ borderBottom: '2px solid #000', minWidth: '300px', display: 'inline-block', textAlign: 'left' }}>{date}</span>
            </div>
          </div>
        </div>

        {/* Waybill Title */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', margin: '32px 0' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.3em' }}>WAYBILL</h2>
          <span style={{ fontSize: '24px', fontFamily: 'monospace', letterSpacing: '0.2em' }}>{waybillNumber || "________"}</span>
        </div>

        {/* Table */}
        <div style={{ border: '3px solid #000', marginBottom: '48px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#1f2937', color: '#fff' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', fontSize: '16px', borderRight: '1px solid #4b5563', width: '96px' }}>Qty</th>
                <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', fontSize: '16px', borderRight: '1px solid #4b5563', width: '192px' }}>Reference</th>
                <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', fontSize: '16px' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((item, index) => (
                <tr key={index} style={{ borderBottom: index < tableRows.length - 1 ? '1px solid #000' : 'none' }}>
                  <td style={{ padding: '16px', borderRight: '1px solid #000', minHeight: '50px' }}>{item.qty}</td>
                  <td style={{ padding: '16px', borderRight: '1px solid #000', minHeight: '50px' }}>{item.reference}</td>
                  <td style={{ padding: '16px', minHeight: '50px' }}>{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signature Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginTop: '64px' }}>
          <div>
            <div style={{ fontSize: '16px', fontStyle: 'italic', fontWeight: '500', marginBottom: '24px' }}>Issued in good condition by</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '14px' }}>Name:</span>
                <span style={{ borderBottom: '2px solid #000', flex: 1, paddingBottom: '4px' }}>{issuedBy}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '14px' }}>Signature:</span>
                <span style={{ borderBottom: '2px solid #000', flex: 1, height: '48px' }}></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '14px' }}>Date:</span>
                <span style={{ borderBottom: '2px solid #000', flex: 1, paddingBottom: '4px' }}></span>
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '16px', fontStyle: 'italic', fontWeight: '500', marginBottom: '24px' }}>Received in good condition by</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '14px' }}>Name:</span>
                <span style={{ borderBottom: '2px solid #000', flex: 1, paddingBottom: '4px' }}>{receivedBy}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '14px' }}>Signature:</span>
                <span style={{ borderBottom: '2px solid #000', flex: 1, height: '48px' }}></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ fontSize: '14px' }}>Date:</span>
                <span style={{ borderBottom: '2px solid #000', flex: 1, paddingBottom: '4px' }}></span>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};
