-- Migration: Rename unit 'Kementerian Advokasi dan Kesejahteraan Mahasiswa' to 'Kementerian Advokasi Kesejahteraan Mahasiswa'

DO $$
BEGIN
  UPDATE public.ref_units
  SET nama_unit = 'Kementerian Advokasi Kesejahteraan Mahasiswa'
  WHERE nama_unit = 'Kementerian Advokasi dan Kesejahteraan Mahasiswa';

  UPDATE public.ref_units
  SET nama_unit = 'Advokasi Kesejahteraan Mahasiswa'
  WHERE nama_unit = 'Advokasi dan Kesejahteraan Mahasiswa';
END$$;
