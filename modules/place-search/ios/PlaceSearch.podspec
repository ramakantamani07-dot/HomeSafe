Pod::Spec.new do |s|
  s.name           = 'PlaceSearch'
  s.version        = '1.0.0'
  s.summary        = 'Place and address search via MapKit'
  s.description    = 'Wraps MKLocalSearchCompleter and MKLocalSearch so wayLoc can suggest places and addresses as you type, without a billed API key.'
  s.author         = ''
  s.homepage       = 'https://wayloc.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
