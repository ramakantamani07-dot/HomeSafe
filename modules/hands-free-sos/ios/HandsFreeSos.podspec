Pod::Spec.new do |s|
  s.name           = 'HandsFreeSos'
  s.version        = '1.0.0'
  s.summary        = 'Hands-free SOS key storage'
  s.description    = 'Keeps the hands-free SOS key in a Keychain group shared with the Siri extension.'
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
